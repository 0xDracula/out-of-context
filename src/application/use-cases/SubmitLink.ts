import type { KnownBlock } from '@slack/types';
import type { WebClient } from '@slack/web-api';
import { Submission, SubmissionStatus } from '../../domain/entities/Submission.js';
import { OptInStatus, User, UserRole } from '../../domain/entities/User.js';
import type { ISubmissionRepository } from '../../domain/interfaces/ISubmissionRepository.js';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository.js';
import { logger } from '../../shared/utils/logger.js';
import { postToOocChannel } from '../../shared/utils/ooc-post.js';

const OOC_RULES_BLOCK: KnownBlock = {
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: "*#out-of-context rules:*\nYou can take messages out of context as long as they still follow Hack Club's code of conduct:\n• Don't use out-of-context messages to create sexual or inappropriate content\n• Don't take messages out of context in a way that harmfully targets another person\n• Don't post content that would violate the code of conduct if it had been written intentionally",
  },
};

const OOC_ACCEPT_COC_ACTIONS_BLOCK: KnownBlock = {
  type: 'actions',
  elements: [
    {
      type: 'button',
      text: { type: 'plain_text', text: 'Accept Rules', emoji: true },
      style: 'primary',
      action_id: 'ooc_accept_coc',
    },
  ],
};

const OOC_OPT_IN_ACTIONS_BLOCK: KnownBlock = {
  type: 'actions',
  elements: [
    {
      type: 'button',
      text: { type: 'plain_text', text: 'Opt In', emoji: true },
      style: 'primary',
      action_id: 'ooc_opt_in',
    },
    {
      type: 'button',
      text: { type: 'plain_text', text: 'No Thanks', emoji: true },
      action_id: 'ooc_decline_opt_in',
    },
  ],
};

const OOC_COC_FOOTER_BLOCK: KnownBlock = {
  type: 'context',
  elements: [
    {
      type: 'mrkdwn',
      text: "Want your own messages to be submittable too? Use `/b-opt-in`, it's optional!",
    },
  ],
};

const OOC_OPT_IN_FOOTER_BLOCK: KnownBlock = {
  type: 'context',
  elements: [
    {
      type: 'mrkdwn',
      text: 'Use `/b-opt-in` or `/b-opt-out` to manage your preference at any time.',
    },
  ],
};

export interface SubmitLinkRequest {
  slackId: string;
  slackLink: string;
  originalText?: string;
  originalAuthorId?: string;
  originalImageUrl?: string;
}

export interface SubmitLinkResponse {
  submissionId?: string;
  status: 'pending' | 'approved' | 'banned' | 'opted_out' | 'error';
  message: string;
  originalAuthorId?: string;
}

export class SubmitLink {
  constructor(
    private userRepository: IUserRepository,
    private submissionRepository: ISubmissionRepository,
    private slackClient: WebClient,
  ) { }

  async execute(request: SubmitLinkRequest): Promise<SubmitLinkResponse> {
    try {
      let user = await this.userRepository.findBySlackId(request.slackId);

      if (!user) {
        user = new User({
          slackId: request.slackId,
          isTrusted: false,
          isBanned: false,
          optInStatus: OptInStatus.DEFAULT,
          cocAccepted: false,
          role: UserRole.USER,
          approvedCount: 0,
          rejectedCount: 0,
          explicitRejectionCount: 0,
        });
        await this.userRepository.save(user);
      }

      if (user.isBanned) {
        return {
          status: 'banned',
          message: 'You are currently banned from submitting to Out of Context.',
        };
      }

      if (!user.cocAccepted) {
        void this.sendCoCAcceptanceDM(request.slackId);
        return { status: 'opted_out', message: '' };
      }

      if (request.originalAuthorId && request.originalAuthorId !== request.slackId) {
        const author = await this.userRepository.findBySlackId(request.originalAuthorId);
        const authorStatus = author?.optInStatus ?? OptInStatus.DEFAULT;

        if (authorStatus === OptInStatus.DEFAULT) {
          const existingWaiting = await this.submissionRepository.findWaitingForAuthor(request.originalAuthorId);
          const waitingSubmission = new Submission({
            slackLink: request.slackLink,
            status: SubmissionStatus.WAITING_FOR_AUTHOR,
            submitterId: request.slackId,
            originalText: request.originalText,
            originalAuthorId: request.originalAuthorId,
            originalImageUrl: request.originalImageUrl,
          });
          await this.submissionRepository.save(waitingSubmission);
          if (existingWaiting.length === 0) {
            void this.sendAuthorOptInDM(request.originalAuthorId);
          }
          return {
            status: 'opted_out',
            message: `<@${request.originalAuthorId}> hasn't opted in to #out-of-context yet. We've sent them an invite, you'll be notified when they respond!`,
            originalAuthorId: request.originalAuthorId,
          };
        }

        if (authorStatus === OptInStatus.OPTED_OUT) {
          return {
            status: 'opted_out',
            message: `<@${request.originalAuthorId}> has opted out of #out-of-context.`,
            originalAuthorId: request.originalAuthorId,
          };
        }
      }

      const isTrusted = user.isTrusted;
      const status = isTrusted ? SubmissionStatus.APPROVED : SubmissionStatus.PENDING;

      const submission = new Submission({
        slackLink: request.slackLink,
        status: status,
        submitterId: user.slackId,
        originalText: request.originalText,
        originalAuthorId: request.originalAuthorId,
        originalImageUrl: request.originalImageUrl,
      });

      const savedSubmission = await this.submissionRepository.save(submission);

      if (isTrusted) {
        try {
          const originalContent =
            request.originalText || request.originalImageUrl
              ? {
                text: request.originalText ?? '',
                authorId: request.originalAuthorId ?? user.slackId,
                imageUrl: request.originalImageUrl,
              }
              : undefined;
          postToOocChannel(
            this.slackClient,
            submission.slackLink,
            user.slackId,
            originalContent,
            this.submissionRepository,
            savedSubmission.id,
          );
          await this.userRepository.updateStats(user.slackId, { approved: 1 });
        } catch (error) {
          logger.error('Failed to post trusted submission:', error);
        }

        return {
          submissionId: savedSubmission.id,
          status: 'approved',
          message: 'Your submission has been automatically approved and posted! (Trusted User). stay a goodboy',
        };
      }

      return {
        submissionId: savedSubmission.id,
        status: 'pending',
        message: "Your submission has been received and is waiting for moderator review. won't take long!",
      };
    } catch (error) {
      logger.error('[SubmitLink] error:', error);
      return {
        status: 'error',
        message:
          error instanceof Error && error.message === 'Invalid Slack message link'
            ? "That doesn't look like a valid Slack message link."
            : 'Something went wrong, please try again.',
      };
    }
  }

  private async sendCoCAcceptanceDM(userId: string): Promise<void> {
    const blocks: KnownBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Accept the #out-of-context rules', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'To submit messages to #out-of-context, you need to accept the rules below.',
        },
      },
      OOC_RULES_BLOCK,
      OOC_ACCEPT_COC_ACTIONS_BLOCK,
      OOC_COC_FOOTER_BLOCK,
    ];

    try {
      await this.slackClient.chat.postMessage({
        channel: userId,
        text: 'Accept the #out-of-context rules',
        blocks,
      });
    } catch (err) {
      logger.error('[SubmitLink] Failed to send CoC acceptance DM:', err);
    }
  }

  private async sendAuthorOptInDM(authorId: string): Promise<void> {
    const blocks: KnownBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Someone wants to share your message', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "Someone tried to submit one of your messages to #out-of-context.\n\nYou're not opted in yet, would you like to allow this?",
        },
      },
      OOC_RULES_BLOCK,
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '_Opting in allows others to submit your messages and lets you submit theirs._',
        },
      },
      OOC_OPT_IN_ACTIONS_BLOCK,
      OOC_OPT_IN_FOOTER_BLOCK,
    ];

    try {
      await this.slackClient.chat.postMessage({
        channel: authorId,
        text: 'Someone wants to share your message',
        blocks,
      });
    } catch (err) {
      logger.error('[SubmitLink] Failed to send author opt-in DM:', err);
    }
  }
}
