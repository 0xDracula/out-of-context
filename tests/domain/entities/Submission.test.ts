import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Submission, SubmissionStatus } from '../../../src/domain/entities/Submission.js';

describe('Submission Entity', () => {
  const validLink = 'https://workspace.slack.com/archives/C12345/p1620000000000000';

  it('should create a submission with a valid Slack link', () => {
    const submission = new Submission({
      slackLink: validLink,
      status: SubmissionStatus.PENDING,
      submitterId: 'user-1',
    });
    assert.strictEqual(submission.slackLink, validLink);
  });

  it('should throw an error for an invalid Slack link', () => {
    assert.throws(() => {
      new Submission({
        slackLink: 'https://google.com',
        status: SubmissionStatus.PENDING,
        submitterId: 'user-1',
      });
    }, /Invalid Slack message link/);
  });

  it('should change status to APPROVED when approved', () => {
    const submission = new Submission({
      slackLink: validLink,
      status: SubmissionStatus.PENDING,
      submitterId: 'user-1',
    });
    submission.approve('Looks good!');
    assert.strictEqual(submission.status, SubmissionStatus.APPROVED);
  });

  it('should change status to REJECTED_EXPLICIT when rejected as explicit', () => {
    const submission = new Submission({
      slackLink: validLink,
      status: SubmissionStatus.PENDING,
      submitterId: 'user-1',
    });
    submission.reject(true, 'NSFW');
    assert.strictEqual(submission.status, SubmissionStatus.REJECTED_EXPLICIT);
  });
});
