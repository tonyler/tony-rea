import {
  initializeStorage,
  getProject,
  createEntry,
  compileKB,
  callLLM,
  getFeedIngestPrompt,
  FeedIngestResponseSchema,
  type Entry,
  type FeedIngestResponse,
} from '@tony-rea/shared';
import { QueuedMessage, ProcessingResult } from '../types';
import { classifyMessage } from './classifier';
import { createLogger } from './logger';
import { env } from '../config/env';

const logger = createLogger('Processor');

// Initialize storage on module load
let storageInitialized = false;

export async function initProcessor(): Promise<void> {
  if (storageInitialized) return;

  await initializeStorage(env.DATA_DIR);
  storageInitialized = true;
  logger.info('Processor initialized', { dataDir: env.DATA_DIR });
}

/**
 * Process a queued message
 */
export async function processMessage(message: QueuedMessage): Promise<ProcessingResult> {
  try {
    // Verify project exists
    const project = await getProject(message.projectId);
    if (!project) {
      logger.warn('Project not found', { projectId: message.projectId });
      return { success: false, action: 'skipped', error: 'Project not found' };
    }

    // If not whitelisted, classify first
    if (!message.isWhitelisted) {
      const classification = await classifyMessage(message.content, {
        authorTag: message.authorTag,
      });

      if (!classification || !classification.isKnowledge) {
        logger.debug('Message classified as non-knowledge', {
          messageId: message.id,
          isKnowledge: classification?.isKnowledge ?? false,
          confidence: classification?.confidence ?? 'n/a',
        });
        return { success: true, action: 'skipped' };
      }

      logger.info('Message classified as knowledge', {
        messageId: message.id,
        confidence: classification.confidence,
        suggestedTitle: classification.suggestedTitle,
      });
    }

    // Process message and create entries (may split into multiple if multi-topic)
    const ingestResponse = await processContent(message);
    if (!ingestResponse || ingestResponse.entries.length === 0) {
      return { success: false, action: 'failed', error: 'Content processing failed' };
    }

    // Create all entries
    const createdEntries: Entry[] = [];
    for (const entryData of ingestResponse.entries) {
      // Ensure source is set
      if (!entryData.sources || entryData.sources.length === 0) {
        entryData.sources = [message.messageUrl];
      }
      // Set date if not detected
      if (!entryData.date_detected) {
        entryData.date_detected = message.timestamp.toISOString().split('T')[0];
      }

      const entry = await createEntry(message.projectId, entryData);
      createdEntries.push(entry);

      logger.info('Created entry', {
        entryId: entry.id,
        title: entryData.title,
        projectId: message.projectId,
      });
    }

    // Recompile KB index
    await compileKB(message.projectId);

    return {
      success: true,
      action: 'created',
      entryId: createdEntries[0]?.id,
    };
  } catch (error) {
    logger.error('Processing failed', {
      messageId: message.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { success: false, action: 'failed', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Process content and create entries (may split into multiple if multi-topic)
 */
async function processContent(message: QueuedMessage): Promise<FeedIngestResponse | null> {
  try {
    const userPrompt = `Content to process:\n\n${message.content}\n\nProvided sources:\n${message.messageUrl}`;

    const result = await callLLM(
      {
        userPrompt,
        systemPrompt: getFeedIngestPrompt(),
        maxRetries: 1,
        mode: 'feedIngest',
      },
      FeedIngestResponseSchema
    );

    if (!result.success) {
      logger.error('Content processing failed', { error: result.error });
      return null;
    }

    return result.data;
  } catch (error) {
    logger.error('Content processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

