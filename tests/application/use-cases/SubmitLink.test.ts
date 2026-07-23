import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import type { WebClient } from '@slack/web-api';
import { SubmitLink } from '../../../src/application/use-cases/SubmitLink.js';
import { SubmissionStatus } from '../../../src/domain/entities/Submission.js';
import { OptInStatus, User, UserRole } from '../../../src/domain/entities/User.js';
import type { ISubmissionRepository } from '../../../src/domain/interfaces/ISubmissionRepository.js';
import type { IUserRepository } from '../../../src/domain/interfaces/IUserRepository.js';

describe('SubmitLink Use Case', () => {
  const validLink = 'https://workspace.slack.com/archives/C12345/p1620000000000000';

  const setup = (userOverride?: User | null) => {
    const mockSlackClient = {
      chat: {
        postMessage: mock.fn(async () => ({})),
      },
    };
    const mockUserRepo = {
      findBySlackId: mock.fn(async () => (userOverride === undefined ? null : userOverride)),
      save: mock.fn(async (u: User) => u),
      updateStats: mock.fn(async () => {}),
    } as unknown as IUserRepository;
    const mockSubmissionRepo = {
      save: mock.fn(async (s: { toJSON(): object }) => ({ ...s.toJSON(), id: 'sub-123' })),
      findWaitingForAuthor: mock.fn(async () => []),
      assignNextNumber: mock.fn(async () => 1),
    } as unknown as ISubmissionRepository;

    return {
      useCase: new SubmitLink(mockUserRepo, mockSubmissionRepo, mockSlackClient as unknown as WebClient),
      mockUserRepo,
      mockSubmissionRepo,
      mockSlackClient,
    };
  };

  it('should create a pending submission for a user who has accepted CoC', async () => {
    const cocAcceptedUser = new User({
      slackId: 'U123',
      role: UserRole.USER,
      isTrusted: false,
      isBanned: false,
      optInStatus: OptInStatus.OPTED_IN,
      cocAccepted: true,
      approvedCount: 0,
      rejectedCount: 0,
      explicitRejectionCount: 0,
    });
    const { useCase, mockUserRepo, mockSubmissionRepo } = setup(cocAcceptedUser);

    const response = await useCase.execute({ slackId: 'U123', slackLink: validLink });

    assert.strictEqual(response.status, 'pending');
    assert.strictEqual((mockUserRepo.save as unknown as { mock: { callCount(): number } }).mock.callCount(), 0);
    assert.strictEqual((mockSubmissionRepo.save as unknown as { mock: { callCount(): number } }).mock.callCount(), 1);
  });

  it('should return opted_out and send CoC DM for a new user who has not accepted CoC', async () => {
    const { useCase, mockSlackClient } = setup(null);

    const response = await useCase.execute({ slackId: 'U123', slackLink: validLink });

    assert.strictEqual(response.status, 'opted_out');
    assert.strictEqual(mockSlackClient.chat.postMessage.mock.callCount(), 1);
  });

  it('should reject submission if user is banned', async () => {
    const bannedUser = new User({
      slackId: 'U123',
      role: UserRole.USER,
      isTrusted: false,
      isBanned: true,
      optInStatus: OptInStatus.OPTED_IN,
      cocAccepted: true,
      approvedCount: 0,
      rejectedCount: 0,
      explicitRejectionCount: 0,
    });
    const { useCase, mockSubmissionRepo } = setup(bannedUser);

    const response = await useCase.execute({ slackId: 'U123', slackLink: validLink });

    assert.strictEqual(response.status, 'banned');
    assert.strictEqual((mockSubmissionRepo.save as unknown as { mock: { callCount(): number } }).mock.callCount(), 0);
  });

  it('should automatically approve if user is trusted', async () => {
    const trustedUser = new User({
      slackId: 'U123',
      role: UserRole.USER,
      isTrusted: true,
      isBanned: false,
      optInStatus: OptInStatus.OPTED_IN,
      cocAccepted: true,
      approvedCount: 10,
      rejectedCount: 0,
      explicitRejectionCount: 0,
    });
    const { useCase, mockSubmissionRepo, mockSlackClient } = setup(trustedUser);

    const response = await useCase.execute({ slackId: 'U123', slackLink: validLink });

    assert.strictEqual(response.status, 'approved');
    const savedSubmission = (mockSubmissionRepo.save as unknown as { mock: { calls: { arguments: unknown[] }[] } }).mock
      .calls[0].arguments[0] as { status: string };
    assert.strictEqual(savedSubmission.status, SubmissionStatus.APPROVED);

    assert.strictEqual(mockSlackClient.chat.postMessage.mock.callCount(), 0);
  });
});
