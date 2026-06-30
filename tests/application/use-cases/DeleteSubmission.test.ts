import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import { DeleteSubmission } from '../../../src/application/use-cases/DeleteSubmission.js';
import { SubmissionStatus } from '../../../src/domain/entities/Submission.js';
import type { ISubmissionRepository } from '../../../src/domain/interfaces/ISubmissionRepository.js';

describe('DeleteSubmission Use Case', () => {
  it('should successfully delete a pending submission belonging to the user', async () => {
    const mockSubRepo = {
      findById: mock.fn(async () => ({
        id: 'sub-1',
        submitterId: 'U123',
        status: SubmissionStatus.PENDING,
      })),
      delete: mock.fn(async () => {}),
    };

    const useCase = new DeleteSubmission(mockSubRepo as unknown as ISubmissionRepository);
    const result = await useCase.execute({
      slackId: 'U123',
      submissionId: 'sub-1',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(mockSubRepo.delete.mock.callCount(), 1);
  });

  it('should fail if submission does not belong to the user', async () => {
    const mockSubRepo = {
      findById: mock.fn(async () => ({
        id: 'sub-1',
        submitterId: 'OTHER_USER',
        status: SubmissionStatus.PENDING,
      })),
      delete: mock.fn(),
    };

    const useCase = new DeleteSubmission(mockSubRepo as unknown as ISubmissionRepository);
    const result = await useCase.execute({
      slackId: 'U123',
      submissionId: 'sub-1',
    });

    assert.strictEqual(result.success, false);
    assert.match(result.message, /only delete your own/);
  });

  it('should fail if submission is already approved', async () => {
    const mockSubRepo = {
      findById: mock.fn(async () => ({
        id: 'sub-1',
        submitterId: 'U123',
        status: SubmissionStatus.APPROVED,
      })),
      delete: mock.fn(),
    };

    const useCase = new DeleteSubmission(mockSubRepo as unknown as ISubmissionRepository);
    const result = await useCase.execute({
      slackId: 'U123',
      submissionId: 'sub-1',
    });

    assert.strictEqual(result.success, false);
    assert.match(result.message, /already approved/);
  });
});
