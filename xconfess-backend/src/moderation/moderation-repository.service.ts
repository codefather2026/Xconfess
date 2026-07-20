// src/moderation/moderation-repository.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ModerationLog } from './entities/moderation-log.entity';
import {
  buildSafeModerationExcerpt,
  ModerationResult,
  ModerationStatus,
} from './ai-moderation.service';

export interface ModerationEvidence {
  score: number;
  confidence: number;
  categories: string[];
  reasonCodes: string[];
  model: string | null;
  modelVersion: string | null;
  safeExcerpt: string | null;
  status: ModerationStatus;
}

@Injectable()
export class ModerationRepositoryService {
  private readonly logger = new Logger(ModerationRepositoryService.name);

  constructor(
    @InjectRepository(ModerationLog)
    private readonly moderationLogRepo: Repository<ModerationLog>,
  ) {}

  async createLog(
    content: string,
    result: ModerationResult,
    confessionId?: string,
    userId?: string,
    apiProvider?: string,
    manager?: EntityManager,
  ): Promise<ModerationLog> {
    const repo = manager
      ? manager.getRepository(ModerationLog)
      : this.moderationLogRepo;
    const log = repo.create({
      confessionId,
      userId,
      content: buildSafeModerationExcerpt(content, 1000),
      moderationScore: result.score,
      confidence: result.confidence ?? result.score,
      moderationFlags: result.flags,
      reasonCodes: result.reasonCodes ?? this.buildReasonCodes(result.details),
      moderationStatus: result.status,
      details: result.details,
      model: result.model ?? apiProvider ?? 'fallback',
      modelVersion: result.modelVersion ?? 'unknown',
      safeExcerpt: result.safeExcerpt ?? buildSafeModerationExcerpt(content),
      requiresReview: result.requiresReview,
      autoActioned: result.status !== ModerationStatus.PENDING,
      apiProvider: apiProvider || 'fallback',
    });

    return await repo.save(log);
  }

  async syncWebhookResult(
    params: {
      confessionId: string;
      content: string;
      userId?: string;
      result: ModerationResult;
      deliveryHash: string;
      deliveryTimestamp: string;
      signatureValid?: boolean;
      payloadMalformed?: boolean;
      deliveryStale?: boolean;
    },
    manager?: EntityManager,
  ): Promise<{ log: ModerationLog; isIdempotent: boolean }> {
    const repo = manager
      ? manager.getRepository(ModerationLog)
      : this.moderationLogRepo;

    const existing = await repo.findOne({
      where: { confessionId: params.confessionId },
      order: { createdAt: 'DESC' },
    });

    const existingWebhookHash = existing?.metadata?.webhook?.deliveryHash;
    if (existing && existingWebhookHash === params.deliveryHash) {
      return { log: existing, isIdempotent: true };
    }

    const log =
      existing ??
      repo.create({
        confessionId: params.confessionId,
        userId: params.userId,
        content: buildSafeModerationExcerpt(params.content, 1000),
      });

    log.userId = params.userId ?? '';
    log.content = buildSafeModerationExcerpt(params.content, 1000);
    log.moderationScore = params.result.score;
    log.confidence = params.result.confidence ?? params.result.score;
    log.moderationFlags = params.result.flags;
    log.reasonCodes =
      params.result.reasonCodes ?? this.buildReasonCodes(params.result.details);
    log.moderationStatus = params.result.status;
    log.details = params.result.details;
    log.model = params.result.model ?? 'webhook';
    log.modelVersion = params.result.modelVersion ?? 'unknown';
    log.safeExcerpt =
      params.result.safeExcerpt ?? buildSafeModerationExcerpt(params.content);
    log.requiresReview = params.result.requiresReview;
    log.autoActioned = params.result.status !== ModerationStatus.PENDING;
    log.apiProvider = 'webhook';
    log.metadata = {
      ...(existing?.metadata ?? {}),
      webhook: {
        deliveryHash: params.deliveryHash,
        timestamp: params.deliveryTimestamp,
        processedAt: new Date().toISOString(),
        signatureValid: params.signatureValid ?? true,
        payloadMalformed: params.payloadMalformed ?? false,
        stale: params.deliveryStale ?? false,
      },
    };

    return {
      log: await repo.save(log),
      isIdempotent: false,
    };
  }

  async getLatestEvidenceByConfessionIds(
    confessionIds: string[],
  ): Promise<Map<string, ModerationEvidence>> {
    if (confessionIds.length === 0) {
      return new Map();
    }

    const logs = await this.moderationLogRepo
      .createQueryBuilder('log')
      .where('log.confessionId IN (:...confessionIds)', { confessionIds })
      .orderBy('log.confessionId', 'ASC')
      .addOrderBy('log.createdAt', 'DESC')
      .getMany();

    const evidence = new Map<string, ModerationEvidence>();
    for (const log of logs) {
      if (!log.confessionId || evidence.has(log.confessionId)) {
        continue;
      }
      evidence.set(log.confessionId, this.toEvidence(log));
    }

    return evidence;
  }

  private toEvidence(log: ModerationLog): ModerationEvidence {
    return {
      score: Number(log.moderationScore ?? 0),
      confidence: Number(log.confidence ?? log.moderationScore ?? 0),
      categories: log.moderationFlags ?? [],
      reasonCodes: log.reasonCodes ?? this.buildReasonCodes(log.details ?? {}),
      model: log.model ?? null,
      modelVersion: log.modelVersion ?? null,
      safeExcerpt:
        log.safeExcerpt ?? buildSafeModerationExcerpt(log.content ?? ''),
      status: log.moderationStatus,
    };
  }

  private buildReasonCodes(details: Record<string, number> | null): string[] {
    return Object.entries(details ?? {})
      .filter(([, score]) => score > 0)
      .sort(([, left], [, right]) => right - left)
      .map(([category, score]) => `${category}:${Number(score).toFixed(4)}`);
  }

  async updateReview(
    logId: string,
    status: ModerationStatus,
    reviewedBy: string,
    notes?: string,
  ): Promise<ModerationLog> {
    const log = await this.moderationLogRepo.findOne({ where: { id: logId } });

    if (!log) {
      throw new Error('Moderation log not found');
    }

    log.reviewed = true;
    log.reviewedBy = reviewedBy;
    log.reviewedAt = new Date();
    log.moderationStatus = status;
    if (notes) {
      log.reviewNotes = notes;
    }

    return await this.moderationLogRepo.save(log);
  }

  async getPendingReviews(limit = 50, offset = 0) {
    return await this.moderationLogRepo.find({
      where: [
        { requiresReview: true, reviewed: false },
        { moderationStatus: ModerationStatus.FLAGGED, reviewed: false },
      ],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getLogsByConfession(confessionId: string) {
    return await this.moderationLogRepo.find({
      where: { confessionId },
      order: { createdAt: 'DESC' },
    });
  }

  async getLogsByUser(userId: string, limit = 100) {
    return await this.moderationLogRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getModerationStats(startDate?: Date, endDate?: Date) {
    const query = this.moderationLogRepo.createQueryBuilder('log');

    if (startDate) {
      query.andWhere('log.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('log.createdAt <= :endDate', { endDate });
    }

    const total = await query.getCount();

    const byStatus = await query
      .select('log.moderationStatus', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.moderationStatus')
      .getRawMany();

    const avgScore = await query
      .select('AVG(log.moderationScore)', 'avgScore')
      .getRawOne<{ avgScore: string | number | null }>();

    return {
      total,
      byStatus,
      avgScore: avgScore?.avgScore ? Number(avgScore.avgScore) : 0,
    };
  }

  async getAccuracyMetrics() {
    const reviewed = await this.moderationLogRepo.find({
      where: { reviewed: true },
    });

    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (const log of reviewed) {
      const aiPredictedHarmful =
        log.moderationStatus === ModerationStatus.REJECTED ||
        log.moderationStatus === ModerationStatus.FLAGGED;
      const humanConfirmedHarmful =
        log.moderationStatus === ModerationStatus.REJECTED;

      if (aiPredictedHarmful && humanConfirmedHarmful) truePositives++;
      else if (aiPredictedHarmful && !humanConfirmedHarmful) falsePositives++;
      else if (!aiPredictedHarmful && !humanConfirmedHarmful) trueNegatives++;
      else if (!aiPredictedHarmful && humanConfirmedHarmful) falseNegatives++;
    }

    const total = reviewed.length;
    const accuracy = total > 0 ? (truePositives + trueNegatives) / total : 0;
    const precision =
      truePositives + falsePositives > 0
        ? truePositives / (truePositives + falsePositives)
        : 0;
    const recall =
      truePositives + falseNegatives > 0
        ? truePositives / (truePositives + falseNegatives)
        : 0;
    const f1Score =
      precision + recall > 0
        ? (2 * (precision * recall)) / (precision + recall)
        : 0;

    return {
      total,
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
      accuracy,
      precision,
      recall,
      f1Score,
    };
  }
}
