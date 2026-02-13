import { Message, PartialMessage, Embed } from 'discord.js';
import { findConfigForChannel, isTrackedUser } from '../config';
import { messageQueue } from '../services/queue';
import { createLogger } from '../services/logger';
import { QueuedMessage } from '../types';

const logger = createLogger('MessageHandler');

function extractEmbedContent(embeds: Embed[]): string {
  const parts: string[] = [];

  for (const embed of embeds) {
    if (embed.title) parts.push(embed.title);
    if (embed.description) parts.push(embed.description);
    if (embed.fields && embed.fields.length > 0) {
      for (const field of embed.fields) {
        parts.push(`${field.name}: ${field.value}`);
      }
    }
    if (embed.footer?.text) parts.push(embed.footer.text);
  }

  return parts.join('\n');
}

/**
 * Handle incoming Discord messages
 */
export function handleMessage(message: Message): void {
  // Ignore DMs
  if (!message.guild) return;

  const serverId = message.guild.id;
  const channelId = message.channel.id;
  const authorId = message.author.id;

  // Find matching config
  const configResult = findConfigForChannel(serverId, channelId);
  if (!configResult) {
    return;
  }

  const { config, isWhitelisted } = configResult;

  // For monitored channels: skip bots and enforce tracked users
  // For whitelisted channels: allow bots/webhooks but still require tracked users
  if (message.author.bot && !isWhitelisted) {
    logger.debug('Bot message skipped (monitored channel)', {
      messageId: message.id,
      channelId,
      authorTag: message.author.tag,
    });
    return;
  }

  if (!isWhitelisted && !config.trackedUsers.includes(authorId)) {
    logger.debug('Untracked user skipped (monitored channel)', {
      messageId: message.id,
      channelId,
      authorId,
      authorTag: message.author.tag,
    });
    return;
  }

  // Build content: text + embeds
  let content = message.content.trim();
  const embedContent = extractEmbedContent(message.embeds);
  if (embedContent) {
    content = content ? `${content}\n${embedContent}` : embedContent;
  }

  if (content.length < config.minMessageLength) {
    logger.debug('Message too short', {
      messageId: message.id,
      channelId,
      length: content.length,
      hasEmbeds: message.embeds.length > 0,
      isBot: message.author.bot,
      minLength: config.minMessageLength,
    });
    return;
  }

  // Build message URL
  const messageUrl = `https://discord.com/channels/${serverId}/${channelId}/${message.id}`;

  const queuedMessage: QueuedMessage = {
    id: message.id,
    projectId: config.projectId,
    serverId,
    channelId,
    authorId,
    authorTag: message.author.tag,
    content,
    timestamp: message.createdAt,
    isWhitelisted,
    messageUrl,
  };

  messageQueue.enqueue(queuedMessage);

  logger.info('Message queued', {
    messageId: message.id,
    projectId: config.projectId,
    authorTag: message.author.tag,
    isWhitelisted,
    isBot: message.author.bot,
    hasEmbeds: message.embeds.length > 0,
    channelType: isWhitelisted ? 'whitelisted' : 'monitored',
  });
}

/**
 * Handle message updates (edits)
 */
export function handleMessageUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage
): void {
  if (!newMessage.content || !newMessage.author || newMessage.author.bot) return;
  if (!newMessage.guild) return;

  const configResult = findConfigForChannel(
    newMessage.guild.id,
    newMessage.channel.id
  );

  if (!configResult) return;
  if (!configResult.config.trackedUsers.includes(newMessage.author.id)) return;

  logger.info('Message edited (not re-processed)', {
    messageId: newMessage.id,
    projectId: configResult.config.projectId,
    authorTag: newMessage.author.tag,
  });
}
