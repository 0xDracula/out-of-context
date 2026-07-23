import type { WebClient } from '@slack/web-api';
import type { ISubmissionRepository } from '../../domain/interfaces/ISubmissionRepository.js';
import { logger } from '../../shared/utils/logger.js';

export interface DeleteOocPostRequest {
  requesterId: string;
  channelId: string;
  messageTs: string;
}

export interface DeleteOocPostResponse {
  success: boolean;
  message: string;
}

export class DeleteOocPost {
  constructor(
    private submissionRepository: ISubmissionRepository,
    private slackClient: WebClient,
  ) {}

  async execute(request: DeleteOocPostRequest): Promise<DeleteOocPostResponse> {
    const submission = await this.submissionRepository.findByPostedMessage(request.channelId, request.messageTs);

    if (!submission) {
      return { success: false, message: "Couldn't find a submission for this message." };
    }

    const authorId = submission.originalAuthorId ?? submission.submitterId;
    if (authorId !== request.requesterId) {
      return { success: false, message: 'Only the original author of this message can delete it.' };
    }

    try {
      await this.slackClient.chat.delete({ channel: request.channelId, ts: request.messageTs });
    } catch (error) {
      logger.error('[DeleteOocPost] Failed to delete Slack message:', error);
      return { success: false, message: 'Failed to delete the message, please try again.' };
    }

    if (submission.id) {
      await this.submissionRepository.delete(submission.id);
    }

    return { success: true, message: 'Your message has been removed from #out-of-context.' };
  }
}
