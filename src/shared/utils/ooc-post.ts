import type { WebClient } from '@slack/web-api';
import { config } from '../../config/index.js';
import { fetchOriginalMessage } from './slack-message-fetcher.js';
import { fetchUserProfile } from './slack-user-profile.js';

export async function postToOocChannel(
  client: WebClient,
  slackLink: string,
  submitterId: string,
): Promise<void> {
  const originalMsg = await fetchOriginalMessage(client, slackLink);

  const authorId = originalMsg?.authorId ?? submitterId;

  const authorProfile = await fetchUserProfile(client, authorId);

  if (originalMsg?.text) {
    // Forward the original blocks if available, otherwise wrap text in a section
    const contentBlocks: any[] = originalMsg.blocks?.length
      ? sanitizeBlocks(originalMsg.blocks)
      : [{ type: 'section', text: { type: 'mrkdwn', text: originalMsg.text } }];

    try {
      await client.chat.postMessage({
        channel: config.slack.oocChannelId,
        text: originalMsg.text,
        blocks: [
          ...contentBlocks,
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Submitted by <@${submitterId}>  ·  <${slackLink}|View original>`,
              },
            ],
          },
        ],
        username: authorProfile.displayName,
        icon_url: authorProfile.iconUrl,
      });
      return;
    } catch (err) {
      console.error('[ooc-post] Block post failed, falling back:', err);
    }
  }

  // Fallback: post the link with unfurl when we couldn't fetch the original message
  await client.chat.postMessage({
    channel: config.slack.oocChannelId,
    text: `${slackLink}\n_Submitted by <@${submitterId}>_`,
    username: authorProfile.displayName,
    icon_url: authorProfile.iconUrl,
    unfurl_links: true,
  });
}

function sanitizeBlocks(blocks: any[]): any[] {
  return blocks.map(({ block_id: _id, ...rest }) => rest);
}
