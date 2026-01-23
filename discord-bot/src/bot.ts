import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { env } from './config/env';
import { loadAllConfigs } from './config';
import { handleReady } from './handlers/ready';
import { handleMessage, handleMessageUpdate } from './handlers/message';
import { messageQueue } from './services/queue';
import { processMessage, initProcessor } from './services/processor';
import { createLogger } from './services/logger';
import { initializeLLM } from '@tony-rea/shared';

const logger = createLogger('Bot');

let client: Client | null = null;

/**
 * Create and configure the Discord client
 */
export function createClient(): Client {
  const newClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  // Register event handlers
  newClient.on('ready', () => handleReady(newClient));
  newClient.on('messageCreate', handleMessage);
  newClient.on('messageUpdate', handleMessageUpdate);

  // Error handling
  newClient.on('error', (error) => {
    logger.error('Discord client error', { error: error.message });
  });

  newClient.on('warn', (message) => {
    logger.warn('Discord client warning', { message });
  });

  newClient.on('disconnect', () => {
    logger.warn('Discord client disconnected');
  });

  newClient.on('reconnecting', () => {
    logger.info('Discord client reconnecting');
  });

  return newClient;
}

/**
 * Start the Discord bot
 */
export async function startBot(): Promise<void> {
  try {
    logger.info('Starting Discord bot...');

    // Initialize LLM service
    initializeLLM(env.OPENAI_API_KEY, env.OPENAI_MODEL);
    logger.info('LLM service initialized', { model: env.OPENAI_MODEL });

    // Initialize processor (storage)
    await initProcessor();

    // Load project configurations
    const configs = loadAllConfigs();
    logger.info('Loaded project configurations', { count: configs.size });

    if (configs.size === 0) {
      logger.warn('No project configurations found. Bot will not process any messages.');
    }

    // Create Discord client
    client = createClient();

    // Start message queue processor
    messageQueue.start(async (message) => {
      const result = await processMessage(message);
      logger.info('Message processing complete', {
        messageId: message.id,
        projectId: message.projectId,
        success: result.success,
        action: result.action,
        entryId: result.entryId,
      });
    });

    // Login to Discord
    await client.login(env.DISCORD_BOT_TOKEN);
    logger.info('Bot logged in successfully');
  } catch (error) {
    logger.error('Failed to start bot', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Stop the Discord bot gracefully
 */
export async function stopBot(): Promise<void> {
  logger.info('Stopping bot...');

  // Stop message queue
  messageQueue.stop();

  // Destroy Discord client
  if (client) {
    client.destroy();
    client = null;
  }

  logger.info('Bot stopped');
}

/**
 * Get the Discord client instance
 */
export function getClient(): Client | null {
  return client;
}

/**
 * Get bot status
 */
export function getBotStatus(): {
  connected: boolean;
  username?: string;
  guilds?: number;
  queue: ReturnType<typeof messageQueue.getStatus>;
} {
  return {
    connected: client?.isReady() ?? false,
    username: client?.user?.tag,
    guilds: client?.guilds.cache.size,
    queue: messageQueue.getStatus(),
  };
}
