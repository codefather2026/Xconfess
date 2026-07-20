import { ConfigService } from '@nestjs/config';
import {
  AiModerationService,
  buildSafeModerationExcerpt,
  ModerationStatus,
} from './ai-moderation.service';

describe('AiModerationService', () => {
  function createService(overrides: Record<string, unknown> = {}) {
    const config = {
      OPENAI_API_KEY: '',
      PERSPECTIVE_API_KEY: '',
      MODERATION_HIGH_THRESHOLD: 0.8,
      MODERATION_MEDIUM_THRESHOLD: 0.5,
      AUTO_ACTION_ENABLED: true,
      ENABLED_MODERATION_CATEGORIES:
        'hate_speech,harassment,self_harm,violence,sexual,spam',
      ...overrides,
    };

    return new AiModerationService({
      get: jest.fn((key: string, defaultValue?: unknown) =>
        key in config ? config[key] : defaultValue,
      ),
    } as unknown as ConfigService);
  }

  it('returns configuration from defaults', () => {
    const service = createService();

    expect(service.getConfiguration()).toMatchObject({
      highThreshold: 0.8,
      mediumThreshold: 0.5,
      autoActionEnabled: true,
    });
  });

  it('falls back to rule-based moderation without API keys', async () => {
    const service = createService();

    const result = await service.moderateContent('a calm confession');

    expect(result.status).toBe(ModerationStatus.APPROVED);
    expect(result.requiresReview).toBe(false);
    expect(result).toMatchObject({
      confidence: 0,
      model: 'rule-based',
      modelVersion: '2026-07-20',
      reasonCodes: [],
    });
  });

  it('creates redacted safe excerpts for moderation evidence', () => {
    const excerpt = buildSafeModerationExcerpt(
      'Email me at user@example.com or call +1 415 555 1234: kill kill',
    );

    expect(excerpt).toContain('[email]');
    expect(excerpt).toContain('[phone]');
    expect(excerpt).not.toContain('user@example.com');
    expect(excerpt).not.toContain('415 555 1234');
  });
});
