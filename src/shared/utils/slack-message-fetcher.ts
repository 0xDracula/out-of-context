import type { WebClient } from '@slack/web-api';

export interface FetchedMessage {
  text: string;
  authorId?: string;
  blocks?: any[];
}

export async function fetchOriginalMessage(
  client: WebClient,
  slackLink: string,
): Promise<FetchedMessage | null> {
  const match = slackLink.match(/\/archives\/([A-Z0-9]+)\/p(\d{10})(\d{6})/);
  if (!match) return null;

  const channelId = match[1];
  const ts = `${match[2]}.${match[3]}`;

  try {
    // Auto-join public channels so we can read their history
    if (channelId.startsWith('C')) {
      try {
        await client.conversations.join({ channel: channelId });
      } catch {
        // Already in channel or not joinable — try fetching anyway
      }
    }

    const result = await client.conversations.history({
      channel: channelId,
      latest: ts,
      oldest: ts,
      inclusive: true,
      limit: 1,
    });

    const message = result.messages?.[0];
    if (!message) return null;

    return {
      text: message.text || '',
      authorId: message.user,
      blocks: (message.blocks as any[]) || undefined,
    };
  } catch (error) {
    console.error('[ooc] Failed to fetch original message:', error);
    return null;
  }
}
