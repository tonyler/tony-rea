/**
 * One-time backfill script to collect historical messages from Discord channels
 *
 * Usage: npx tsx src/scripts/backfill.ts <config-name>
 * Example: npx tsx src/scripts/backfill.ts sphinx-protocol
 */

import { Client, GatewayIntentBits, TextChannel, NewsChannel, Message, Collection } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import { ProjectConfigSchema } from '../types';
import { initProcessor, processMessage } from '../services/processor';
import { createLogger } from '../services/logger';
import { QueuedMessage } from '../types';
import {
  initializeLLM,
  initializeStorage,
  getProject,
  createProject,
} from '@tony-rea/shared';

const logger = createLogger('Backfill');

// Backfill state tracking
interface BackfillState {
  lastBackfillTimestamp: string; // ISO date string
}

function getStateFilePath(projectId: string): string {
  return path.join(__dirname, '../../data', `backfill-state-${projectId}.json`);
}

function loadBackfillState(projectId: string): BackfillState | null {
  const stateFile = getStateFilePath(projectId);
  if (fs.existsSync(stateFile)) {
    const content = fs.readFileSync(stateFile, 'utf-8');
    return JSON.parse(content) as BackfillState;
  }
  return null;
}

function saveBackfillState(projectId: string, state: BackfillState): void {
  const stateFile = getStateFilePath(projectId);
  const dir = path.dirname(stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

// Rate limiting: wait between messages to avoid API limits
const DELAY_BETWEEN_MESSAGES_MS = 3000;
const DELAY_BETWEEN_CHANNELS_MS = 5000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllMessages(channel: TextChannel | NewsChannel): Promise<Message[]> {
  const allMessages: Message[] = [];
  let lastMessageId: string | undefined;

  logger.info(`Fetching messages from #${channel.name}...`);

  while (true) {
    const options: { limit: number; before?: string } = { limit: 100 };
    if (lastMessageId) {
      options.before = lastMessageId;
    }

    const messages: Collection<string, Message> = await channel.messages.fetch(options);

    if (messages.size === 0) {
      break;
    }

    allMessages.push(...messages.values());
    lastMessageId = messages.last()?.id;

    logger.info(`Fetched ${allMessages.length} messages so far from #${channel.name}`);

    // Small delay to avoid rate limits
    await sleep(1000);
  }

  // Return in chronological order (oldest first)
  return allMessages.reverse();
}

async function main() {
  const args = process.argv.slice(2);
  const forceFlag = args.includes('--force');
  const configName = args.find(arg => !arg.startsWith('--'));

  if (!configName) {
    console.error('Usage: npx tsx src/scripts/backfill.ts <config-name> [--force]');
    console.error('Example: npx tsx src/scripts/backfill.ts sphinx-protocol');
    console.error('Options:');
    console.error('  --force    Ignore previous backfill state and process all messages');
    process.exit(1);
  }

  const configPath = path.join(__dirname, '../../config', `${configName}.json`);

  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  // Load config
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const rawConfig = JSON.parse(configContent);
  const config = ProjectConfigSchema.parse(rawConfig);

  logger.info('Loaded config', {
    projectId: config.projectId,
    serverId: config.serverId,
    whitelistedChannels: config.whitelistedChannels.length,
  });

  // Initialize services
  logger.info('Initializing services...');
  initializeLLM(env.OPENAI_API_KEY, env.OPENAI_MODEL);
  await initializeStorage(env.DATA_DIR);
  await initProcessor();

  // Ensure project exists
  let project = await getProject(config.projectId);
  if (!project) {
    logger.info(`Creating project: ${config.projectId}`);
    project = await createProject(config.projectId, `Backfilled from Discord`);
  }

  // Load previous backfill state (unless --force is used)
  const previousState = forceFlag ? null : loadBackfillState(config.projectId);
  const lastBackfillDate = previousState ? new Date(previousState.lastBackfillTimestamp) : null;

  if (forceFlag) {
    logger.info('Force mode: ignoring previous backfill state, will process all messages');
  } else if (lastBackfillDate) {
    logger.info(`Last backfill: ${lastBackfillDate.toISOString()} - will only process newer messages`);
  } else {
    logger.info('No previous backfill found - will process all messages');
  }

  // Create Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Wait for ready
  await new Promise<void>((resolve, reject) => {
    client.once('ready', () => {
      logger.info(`Logged in as ${client.user?.tag}`);
      resolve();
    });
    client.once('error', reject);
    client.login(env.DISCORD_BOT_TOKEN);
  });

  try {
    // Get the server
    const guild = client.guilds.cache.get(config.serverId);
    if (!guild) {
      logger.error(`Server not found: ${config.serverId}`);
      process.exit(1);
    }

    logger.info(`Connected to server: ${guild.name}`);

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let newestMessageTimestamp: Date | null = null;

    // Process each whitelisted channel
    for (const channelId of config.whitelistedChannels) {
      const channel = guild.channels.cache.get(channelId);

      if (!channel) {
        logger.warn(`Channel not found: ${channelId}`);
        continue;
      }

      if (!channel.isTextBased() || (!(channel instanceof TextChannel) && !(channel instanceof NewsChannel))) {
        logger.warn(`Channel is not a text/announcement channel: ${channelId}`);
        continue;
      }

      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`Processing channel: #${channel.name} (${channelId})`);
      logger.info(`${'='.repeat(60)}\n`);

      // Fetch all messages
      const messages = await fetchAllMessages(channel as TextChannel | NewsChannel);
      logger.info(`Found ${messages.length} total messages in #${channel.name}`);

      // Filter messages
      const validMessages = messages.filter((msg) => {
        // Skip bots
        if (msg.author.bot) return false;
        // Skip short messages
        if (msg.content.trim().length < config.minMessageLength) return false;
        // Skip messages already processed in previous backfill
        if (lastBackfillDate && msg.createdAt <= lastBackfillDate) return false;
        return true;
      });

      logger.info(`${validMessages.length} messages pass filters (non-bot, min length, after last backfill)`);

      // Process each message
      for (let i = 0; i < validMessages.length; i++) {
        const msg = validMessages[i];
        const messageUrl = `https://discord.com/channels/${config.serverId}/${channelId}/${msg.id}`;

        logger.info(`\n[${i + 1}/${validMessages.length}] Processing message from ${msg.author.tag}`);
        logger.info(`Content preview: ${msg.content.substring(0, 100)}...`);

        const queuedMessage: QueuedMessage = {
          id: msg.id,
          projectId: config.projectId,
          serverId: config.serverId,
          channelId: channelId,
          authorId: msg.author.id,
          authorTag: msg.author.tag,
          content: msg.content,
          timestamp: msg.createdAt,
          isWhitelisted: true, // All messages from whitelisted channels are treated as knowledge
          messageUrl,
        };

        try {
          const result = await processMessage(queuedMessage);

          if (result.success) {
            // Track newest message timestamp for state saving
            if (!newestMessageTimestamp || msg.createdAt > newestMessageTimestamp) {
              newestMessageTimestamp = msg.createdAt;
            }

            if (result.action === 'skipped') {
              totalSkipped++;
              logger.info(`Skipped (no extractable knowledge)`);
            } else {
              totalProcessed++;
              logger.info(`Success: ${result.action} - Entry ID: ${result.entryId}`);
            }
          } else {
            totalFailed++;
            logger.error(`Failed: ${result.error}`);
          }
        } catch (error) {
          totalFailed++;
          logger.error(`Error processing message: ${error instanceof Error ? error.message : 'Unknown'}`);
        }

        // Rate limiting delay
        if (i < validMessages.length - 1) {
          await sleep(DELAY_BETWEEN_MESSAGES_MS);
        }
      }

      // Delay between channels
      await sleep(DELAY_BETWEEN_CHANNELS_MS);
    }

    // Save backfill state if we processed any messages
    if (newestMessageTimestamp) {
      saveBackfillState(config.projectId, {
        lastBackfillTimestamp: newestMessageTimestamp.toISOString(),
      });
      logger.info(`Saved backfill state: ${newestMessageTimestamp.toISOString()}`);
    }

    // Summary
    logger.info(`\n${'='.repeat(60)}`);
    logger.info('BACKFILL COMPLETE');
    logger.info(`${'='.repeat(60)}`);
    logger.info(`Total processed: ${totalProcessed}`);
    logger.info(`Total skipped: ${totalSkipped}`);
    logger.info(`Total failed: ${totalFailed}`);

  } finally {
    client.destroy();
    logger.info('Disconnected from Discord');
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
