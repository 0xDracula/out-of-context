import type { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { DeleteSubmission } from '../../../application/use-cases/DeleteSubmission.js';
import { Submission, SubmissionStatus } from '../../../domain/entities/Submission.js';
import { OptInStatus, User, UserRole } from '../../../domain/entities/User.js';
import { PrismaSubmissionRepository } from '../../../infrastructure/repositories/PrismaSubmissionRepository.js';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository.js';
import { postToOocChannel } from '../../../shared/utils/ooc-post.js';

const submissionRepository = new PrismaSubmissionRepository();
const userRepository = new PrismaUserRepository();
const deleteSubmission = new DeleteSubmission(submissionRepository);

export const registerActionHandlers = (app: App) => {
  app.action('delete_submission', async ({ ack, body, action, respond }) => {
    await ack();

    const slackId = body.user.id;
    const submissionId = 'value' in action ? action.value : '';

    if (!submissionId) return;

    const result = await deleteSubmission.execute({ slackId, submissionId });

    await respond({
      text: result.message,
      replace_original: result.success,
    });
  });

  app.action('ooc_accept_coc', async ({ ack, body, respond }) => {
    await ack();
    const slackId = body.user.id;
    const existing = await userRepository.findBySlackId(slackId);
    const base = existing?.toJSON() ?? {
      slackId,
      role: UserRole.USER,
      isTrusted: false,
      isBanned: false,
      optInStatus: OptInStatus.DEFAULT,
      cocAccepted: false,
      approvedCount: 0,
      rejectedCount: 0,
      explicitRejectionCount: 0,
    };
    await userRepository.save(new User({ ...base, cocAccepted: true }));

    const blocks: KnownBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "*Rules accepted!* :white_check_mark:\n\nYou can now submit messages to #out-of-context. Try submitting again!\n\n_Want your own messages to be submittable too? Use `/b-opt-in` at any time; it's optional._",
        },
      },
    ];
    await respond({ replace_original: true, text: 'Rules accepted!', blocks });
  });

  app.action('ooc_opt_in', async ({ ack, body, respond, client }) => {
    await ack();
    const slackId = body.user.id;
    const existing = await userRepository.findBySlackId(slackId);
    const base = existing?.toJSON() ?? {
      slackId,
      role: UserRole.USER,
      isTrusted: false,
      isBanned: false,
      optInStatus: OptInStatus.DEFAULT,
      cocAccepted: false,
      approvedCount: 0,
      rejectedCount: 0,
      explicitRejectionCount: 0,
    };
    await userRepository.save(new User({ ...base, optInStatus: OptInStatus.OPTED_IN, cocAccepted: true }));

    const waiting = await submissionRepository.findWaitingForAuthor(slackId);
    for (const sub of waiting) {
      const submitter = await userRepository.findBySlackId(sub.submitterId);
      if (submitter?.isTrusted) {
        const approved = new Submission({ ...sub.toJSON(), status: SubmissionStatus.APPROVED });
        const savedSub = await submissionRepository.save(approved);
        const originalContent =
          sub.originalText || sub.originalImageUrl
            ? {
                text: sub.originalText ?? '',
                authorId: sub.originalAuthorId ?? sub.submitterId,
                imageUrl: sub.originalImageUrl,
              }
            : undefined;
        postToOocChannel(client, sub.slackLink, sub.submitterId, originalContent, submissionRepository, savedSub.id);
        await userRepository.updateStats(sub.submitterId, { approved: 1 });
        void client.chat.postMessage({
          channel: sub.submitterId,
          text: `<@${slackId}> has opted in to #out-of-context! Your submission has been automatically posted.`,
        });
      } else {
        const promoted = new Submission({ ...sub.toJSON(), status: SubmissionStatus.PENDING });
        await submissionRepository.save(promoted);
        void client.chat.postMessage({
          channel: sub.submitterId,
          text: `<@${slackId}> has opted in to #out-of-context! Your submission is now in the review queue.`,
        });
      }
    }

    const blocks: KnownBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "*You've opted in to #out-of-context!* :tada:\n\nOthers can now submit your messages to the channel, and you can submit theirs too.\n\nUse `/b-opt-out` to opt back out at any time.",
        },
      },
    ];
    await respond({ replace_original: true, text: "You've opted in to #out-of-context!", blocks });
  });

  app.action('ooc_decline_opt_in', async ({ ack, body, respond, client }) => {
    await ack();
    const slackId = body.user.id;
    const existing = await userRepository.findBySlackId(slackId);
    const base = existing?.toJSON() ?? {
      slackId,
      role: UserRole.USER,
      isTrusted: false,
      isBanned: false,
      optInStatus: OptInStatus.DEFAULT,
      cocAccepted: false,
      approvedCount: 0,
      rejectedCount: 0,
      explicitRejectionCount: 0,
    };
    await userRepository.save(new User({ ...base, optInStatus: OptInStatus.OPTED_OUT }));

    const waiting = await submissionRepository.findWaitingForAuthor(slackId);
    for (const sub of waiting) {
      if (sub.id) {
        await submissionRepository.delete(sub.id);
      }
      void client.chat.postMessage({
        channel: sub.submitterId,
        text: `<@${slackId}> has declined to be featured in #out-of-context. Your submission won't be processed.`,
      });
    }

    const blocks: KnownBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "No problem! Your messages won't appear in #out-of-context unless you opt in.\n\nUse `/b-opt-in` if you change your mind.",
        },
      },
    ];
    await respond({
      replace_original: true,
      text: "No problem, your messages won't appear in #out-of-context.",
      blocks,
    });
  });
};
