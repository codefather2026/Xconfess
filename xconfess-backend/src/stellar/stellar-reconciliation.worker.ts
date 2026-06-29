import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { StellarAnchor, AnchorStatus } from './entities/stellar-anchor.entity';
import { StellarService } from './stellar.service';
import { ContractService } from './contract.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActionType } from '../audit-log/audit-log.entity';
import { AnonymousConfession } from '../confession/entities/confession.entity';
import { decryptConfession } from '../utils/confession-encryption';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface ReconciliationConfig {
  interval: string;
  minAgeMinutes: number;
  batchSize: number;
  maxRetries: number;
  backoffBaseMinutes: number;
}

@Injectable()
export class StellarReconciliationWorker {
  private readonly logger = new Logger(StellarReconciliationWorker.name);
  private readonly config: ReconciliationConfig;

  constructor(
    @InjectRepository(StellarAnchor)
    private readonly anchorRepository: Repository<StellarAnchor>,
    @InjectRepository(AnonymousConfession)
    private readonly confessionRepository: Repository<AnonymousConfession>,
    private readonly stellarService: StellarService,
    private readonly contractService: ContractService,
    private readonly auditService: AuditLogService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const envInterval = process.env.STELLAR_RECONCILIATION_INTERVAL;
    this.config = {
      interval: (envInterval as CronExpression) || '*/15 * * * *',
      minAgeMinutes: parseInt(process.env.STELLAR_RECONCILIATION_MIN_AGE || '5', 10),
      batchSize: parseInt(process.env.STELLAR_RECONCILIATION_BATCH_SIZE || '50', 10),
      maxRetries: parseInt(process.env.STELLAR_RECONCILIATION_MAX_RETRIES || '5', 10),
      backoffBaseMinutes: parseInt(process.env.STELLAR_RECONCILIATION_BACKOFF_BASE || '2', 10),
    };
  }

  @Cron(process.env.STELLAR_RECONCILIATION_INTERVAL || '*/15 * * * *')
  async reconcilePendingAnchors() {
    const minAgeMs = this.config.minAgeMinutes * 60 * 1000;
    const anchors = await this.anchorRepository.find({
      where: {
        status: AnchorStatus.PENDING,
        createdAt: LessThan(new Date(Date.now() - minAgeMs)),
      },
      take: this.config.batchSize,
      order: { createdAt: 'ASC' },
    });

    if (anchors.length === 0) return;

    this.logger.log(`Reconciling ${anchors.length} pending anchors (batch size: ${this.config.batchSize})`);

    let reconciled = 0;
    let failed = 0;
    let expired = 0;

    for (const anchor of anchors) {
      const result = await this.retryAnchor(anchor);
      if (result === 'anchored') reconciled++;
      else if (result === 'failed') failed++;
      else if (result === 'expired') expired++;
    }

    this.logger.log(
      `Reconciliation complete: ${reconciled} anchored, ${failed} failed, ${expired} expired`,
    );

    if (failed > 0 || expired > 0) {
      this.eventEmitter.emit('stellar.reconciliation.discrepancies', {
        reconciled,
        failed,
        expired,
        timestamp: new Date(),
      });
    }
  }

  private async retryAnchor(
    anchor: StellarAnchor,
  ): Promise<'anchored' | 'failed' | 'expired' | 'skipped'> {
    const delay = Math.pow(2, anchor.retryCount) * this.config.backoffBaseMinutes * 60 * 1000;
    const timeSinceLastRetry =
      Date.now() - (anchor.lastRetryAt?.getTime() || anchor.createdAt.getTime());

    if (timeSinceLastRetry < delay) {
      return 'skipped';
    }

    anchor.retryCount += 1;
    anchor.lastRetryAt = new Date();

    try {
      this.logger.debug({
        event: 'stellar_anchor_retry',
        anchorId: anchor.id,
        attemptNumber: anchor.retryCount,
      });

      const confession = await this.confessionRepository.findOne({
        where: { id: anchor.confessionId },
      });
      if (!confession) {
        await this.auditService.log({
          actionType: AuditActionType.STELLAR_ANCHOR_RETRY,
          metadata: {
            entityId: anchor.id,
            confessionId: anchor.confessionId,
            error: 'Confession not found',
            attempt_number: anchor.retryCount,
          },
        });
        anchor.status = AnchorStatus.FAILED;
        await this.anchorRepository.save(anchor);
        return 'failed';
      }

      // Check Stellar Horizon for existing transaction status
      if (anchor.stellarTxHash) {
        const txValid = await this.stellarService.verifyTransaction(anchor.stellarTxHash);
        if (txValid) {
          anchor.status = AnchorStatus.ANCHORED;
          anchor.retryCount = 0;
          await this.anchorRepository.save(anchor);

          confession.isAnchored = true;
          confession.anchoredAt = new Date();
          await this.confessionRepository.save(confession);

          this.logger.log(`Anchor confirmed via Horizon check for confession ${anchor.confessionId}`);
          return 'anchored';
        }
      }

      const aesKey = this.configService.get<string>('app.confessionAesKey', '');
      const decryptedMessage = decryptConfession(confession.message, aesKey);

      const timestamp = Date.now();
      const hash = this.stellarService.hashConfession(decryptedMessage, timestamp);

      const serverSecret = this.configService.get<string>('STELLAR_SERVER_SECRET');
      if (!serverSecret) {
        throw new Error('Server secret key not configured');
      }

      const txResult = await this.contractService.anchorConfession(
        hash,
        timestamp,
        serverSecret,
      );

      anchor.status = AnchorStatus.ANCHORED;
      anchor.stellarTxHash = txResult.hash;
      anchor.retryCount = 0;
      await this.anchorRepository.save(anchor);

      confession.isAnchored = true;
      confession.stellarTxHash = txResult.hash;
      confession.stellarHash = hash;
      confession.anchoredAt = new Date();
      await this.confessionRepository.save(confession);

      this.logger.log(`Successfully anchored confession ${anchor.confessionId}`);

      await this.auditService.log({
        actionType: AuditActionType.STELLAR_ANCHOR_RETRY,
        metadata: {
          entityId: anchor.id,
          confessionId: anchor.confessionId,
          result: 'anchored',
          txHash: txResult.hash,
          attempt_number: anchor.retryCount,
        },
      });

      return 'anchored';
    } catch (error: any) {
      this.logger.warn({
        event: 'stellar_anchor_retry_error',
        anchorId: anchor.id,
        attemptNumber: anchor.retryCount,
        error: error.message,
      });

      await this.auditService.log({
        actionType: AuditActionType.STELLAR_ANCHOR_RETRY,
        metadata: {
          entityId: anchor.id,
          confessionId: anchor.confessionId,
          error_message: error.message,
          attempt_number: anchor.retryCount,
        },
      });

      if (anchor.retryCount >= this.config.maxRetries) {
        anchor.status = AnchorStatus.FAILED;

        this.logger.error({
          event: 'stellar_anchor_failed',
          anchorId: anchor.id,
          confessionId: anchor.confessionId,
          attempts: anchor.retryCount,
        });

        await this.auditService.log({
          actionType: AuditActionType.STELLAR_ANCHOR_FAILED,
          metadata: {
            entityId: anchor.id,
            confessionId: anchor.confessionId,
            attempts: anchor.retryCount,
            last_error: error.message,
          },
        });

        await this.anchorRepository.save(anchor);
        return 'failed';
      }

      // Mark as expired if anchor is older than 24 hours and still pending
      const ageHours =
        (Date.now() - anchor.createdAt.getTime()) / (1000 * 60 * 60);
      if (ageHours > 24) {
        anchor.status = AnchorStatus.EXPIRED;
        await this.anchorRepository.save(anchor);

        await this.auditService.log({
          actionType: AuditActionType.STELLAR_ANCHOR_FAILED,
          metadata: {
            entityId: anchor.id,
            confessionId: anchor.confessionId,
            reason: 'expired',
            ageHours,
          },
        });

        this.logger.warn(`Anchor ${anchor.id} expired after ${ageHours.toFixed(1)} hours`);
        return 'expired';
      }

      await this.anchorRepository.save(anchor);
      return 'failed';
    }
  }
}
