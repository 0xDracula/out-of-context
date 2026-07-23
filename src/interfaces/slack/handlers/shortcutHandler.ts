import type { App, MessageShortcut } from '@slack/bolt';
import { DeleteOocPost } from '../../../application/use-cases/DeleteOocPost.js';
import { SubmitLink } from '../../../application/use-cases/SubmitLink.js';
import { config } from '../../../config/index.js';
import { PrismaSubmissionRepository } from '../../../infrastructure/repositories/PrismaSubmissionRepository.js';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository.js';

const userRepository = new PrismaUserRepository();
const submissionRepository = new PrismaSubmissionRepository();

function buildPermalink(domain: string, channelId: string, ts: string): string {
  return `https://${domain}.slack.com/archives/${channelId}/p${ts.replace('.', '')}`;
}

export const registerShortcutHandler = (app: App) => {
  const submitLink = new SubmitLink(userRepository, submissionRepository, app.client);
  const deleteOocPost = new DeleteOocPost(submissionRepository, app.client);

  app.shortcut('delete_ooc_post', async ({ shortcut, ack, client, logger }) => {
    await ack();

    const s = shortcut as MessageShortcut;
    const requesterId = s.user.id;
    const channelId = s.channel.id;

    if (channelId !== config.slack.oocChannelId) {
      await client.chat
        .postEphemeral({
          channel: channelId,
          user: requesterId,
          text: 'This shortcut only works on posts in #out-of-context.',
        })
        .catch((e: unknown) => logger.error('[shortcut] Failed to send ephemeral message:', e));
      return;
    }

    const result = await deleteOocPost.execute({ requesterId, channelId, messageTs: s.message_ts });

    await client.chat
      .postEphemeral({ channel: channelId, user: requesterId, text: result.message })
      .catch((e: unknown) => logger.error('[shortcut] Failed to send ephemeral message:', e));
  });

  app.shortcut('submit_to_ooc', async ({ shortcut, ack, client, logger }) => {
    await ack();

    const s = shortcut as MessageShortcut;
    const slackId = s.user.id;
    const channelId = s.channel.id;
    type SlackFile = { mimetype?: string; url_private?: string };
    type Msg = { text?: string; user?: string; files?: SlackFile[] };
    const msg = s.message as Msg;
    const domain = s.team?.domain ?? s.user.team_id ?? 'hackclub';
    const slackLink = buildPermalink(domain, channelId, s.message_ts);

    const imageFile = msg.files?.find((f) => f.mimetype?.startsWith('image/'));

    const result = await submitLink.execute({
      slackId,
      slackLink,
      originalText: msg.text || undefined,
      originalAuthorId: msg.user || undefined,
      originalImageUrl: imageFile?.url_private,
    });

    if (result.status === 'opted_out') {
      if (result.message) {
        await client.chat.postMessage({ channel: slackId, text: result.message }).catch((e: unknown) => {
          logger.error('[shortcut] Failed to DM user:', e);
        });
      }
      return;
    }

    await client.chat.postMessage({ channel: slackId, text: result.message }).catch((e: unknown) => {
      logger.error('[shortcut] Failed to DM user:', e);
    });
  });
};
