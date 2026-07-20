import { ModerationRepositoryService } from './moderation-repository.service';
import { ModerationCategory, ModerationStatus } from './ai-moderation.service';

describe('ModerationRepositoryService', () => {
  it('creates moderation logs with evidence and redacted content', async () => {
    const repo: any = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'mod-log-1' })),
    };
    const service = new ModerationRepositoryService(repo);

    const saved = await service.createLog(
      'Sensitive email user@example.com and phone +1 415 555 1234. kill kill',
      {
        score: 0.82,
        confidence: 0.82,
        flags: [ModerationCategory.VIOLENCE],
        status: ModerationStatus.REJECTED,
        details: { violence: 0.82 },
        reasonCodes: ['violence:0.8200'],
        model: 'rule-based',
        modelVersion: '2026-07-20',
        safeExcerpt: 'Sensitive email [email] and phone [phone]. kill kill',
        requiresReview: true,
      },
      'conf-1',
      'user-1',
      'rule-based',
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        confessionId: 'conf-1',
        userId: 'user-1',
        moderationScore: 0.82,
        confidence: 0.82,
        moderationFlags: [ModerationCategory.VIOLENCE],
        reasonCodes: ['violence:0.8200'],
        model: 'rule-based',
        modelVersion: '2026-07-20',
        safeExcerpt: 'Sensitive email [email] and phone [phone]. kill kill',
      }),
    );
    expect(saved.content).toContain('[email]');
    expect(saved.content).toContain('[phone]');
    expect(saved.content).not.toContain('user@example.com');
    expect(saved.content).not.toContain('415 555 1234');
  });
});
