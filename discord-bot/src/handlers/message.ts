import { Message, PartialMessage } from 'discord.js';
import { findConfigForChannel, isTrackedUser } from '../config';
import { messageQueue } from '../services/queue';
import { createLogger } from '../services/logger';
import { QueuedMessage } from '../types';

const logger = createLogger('MessageHandler');

/**
 * Handle incoming Discord messages
 */
export function handleMessage(message: Message): void {
  // Ignore bots
  if (message.author.bot) return;

  // Ignore DMs
  if (!message.guild) return;

  const serverId = message.guild.id;
  const channelId = message.channel.id;
  const authorId = message.author.id;

  // Find matching config
  const configResult = findConfigForChannel(serverId, channelId);
  if (!configResult) {
    // Channel not configured, ignore
    return;
  }

  const { config, isWhitelisted } = configResult;

  // Check if user is tracked
  if (!config.trackedUsers.includes(authorId)) {
    // User not tracked, ignore
    return;
  }

  // Check minimum message length
  const content = message.content.trim();
  if (content.length < config.minMessageLength) {
    logger.debug('Message too short', {
      messageId: message.id,
      length: content.length,
      minLength: config.minMessageLength,
    });
    return;
  }

  // Build message URL
  const messageUrl = `https://discord.com/channels/${serverId}/${channelId}/${message.id}`;

  // Queue the message
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
    channelType: isWhitelisted ? 'whitelisted' : 'monitored',
  });
}

/**
 * Handle message updates (edits)
 * For now, we just log them - could be enhanced to re-process
 */
export function handleMessageUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage
): void {
  // Only process if we have the new content
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

  // TODO: Could re-process edited messages in the future
}
