import { SubmissionStatus } from '../../domain/entities/Submission.js';
import type { ISubmissionRepository } from '../../domain/interfaces/ISubmissionRepository.js';

export interface DeleteSubmissionRequest {
  slackId: string;
  submissionId: string;
}

export interface DeleteSubmissionResponse {
  success: boolean;
  message: string;
}

export class DeleteSubmission {
  constructor(private submissionRepository: ISubmissionRepository) {}

  async execute(request: DeleteSubmissionRequest): Promise<DeleteSubmissionResponse> {
    const submission = await this.submissionRepository.findById(request.submissionId);

    if (!submission) {
      return { success: false, message: 'Submission not found.' };
    }

    if (submission.submitterId !== request.slackId) {
      return { success: false, message: 'You can only delete your own submissions.' };
    }

    if (submission.status !== SubmissionStatus.PENDING) {
      return {
        success: false,
        message: `Cannot delete a submission that is already ${submission.status.toLowerCase()}.`,
      };
    }

    await this.submissionRepository.delete(request.submissionId);

    return { success: true, message: 'Submission deleted successfully.' };
  }
}
