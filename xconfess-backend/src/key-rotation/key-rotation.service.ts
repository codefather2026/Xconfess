import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { EncryptionService } from './encryption.service';
import { Confession } from '../confessions/confession.entity';

export interface RotationResult {
  total: number;
  rotated: number;
  alreadyCurrent: number;
  failed: number;
  errors: Array<{ confessionId: string; error: string }>;
}

@Injectable()
export class KeyRotationService {
  private readonly logger = new Logger(KeyRotationService.name);

  constructor(
    @InjectRepository(Confession)
    private readonly confessionRepo: Repository<Confession>,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Rotate all confessions that are NOT on the current key version.
   * Processes in batches to avoid memory pressure and allow progress reporting.
   *
   * Only wrappedDek + keyVersion columns are updated — encryptedContent is never touched.
   */
  async rotateMasterKey(batchSize = 500): Promise<RotationResult> {
    const result: RotationResult = {
      total: 0,
      rotated: 0,
      alreadyCurrent: 0,
      failed: 0,
      errors: [],
    };

    // Only fetch confessions using envelope encryption (have a wrappedDek)
    // that are not yet on the current key version.
    // Legacy confessions (legacyCiphertext IS NOT NULL) are handled by the
    // migration script, not here.
    let offset = 0;

    while (true) {
      const batch = await this.confessionRepo.find({
        where: {
          wrappedDek: Not(''), // has envelope encryption
          migrationStatus: 'completed', // only fully migrated rows
        },
        select: ['id', 'encryptedContent', 'wrappedDek', 'keyVersion'],
        take: batchSize,
        skip: offset,
        order: { id: 'ASC' },
      });

      if (batch.length === 0) break;
      result.total += batch.length;

      this.logger.log(
        `Rotating batch offset=${offset}, size=${batch.length}`,
      );

      for (const confession of batch) {
        try {
          if (this.encryptionService.isCurrentVersion(confession.keyVersion)) {
            result.alreadyCurrent++;
            continue;
          }

          const rewrapped = this.encryptionService.rewrapDek({
            encryptedContent: confession.encryptedContent,
            wrappedDek: confession.wrappedDek,
            keyVersion: confession.keyVersion,
          });

          await this.confessionRepo.update(confession.id, {
            wrappedDek: rewrapped.wrappedDek,
            keyVersion: rewrapped.keyVersion,
            // encryptedContent deliberately NOT updated
          });

          result.rotated++;
        } catch (err: any) {
          result.failed++;
          result.errors.push({
            confessionId: confession.id,
            error: err?.message ?? String(err),
          });
          this.logger.error(
            `Failed to rotate confession ${confession.id}: ${err?.message}`,
          );
        }
      }

      offset += batchSize;

      // Small yield between batches to avoid starving other DB operations
      await new Promise((r) => setTimeout(r, 10));
    }

    this.logger.log(
      `Rotation complete: total=${result.total} rotated=${result.rotated} ` +
        `already_current=${result.alreadyCurrent} failed=${result.failed}`,
    );

    return result;
  }
}