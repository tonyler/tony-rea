import {
  initializeStorage,
  getProject,
  compileKB,
  callLLM,
  getFeedIngestPrompt,
  FeedIngestResponseSchema,
  type Entry,
  type FeedIngestResponse,
  curateAndSaveIngestEntry,
  type CuratedIngestAction,
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

    // Create or merge all entries via shared curation flow
    const createdEntries: Entry[] = [];
    const actions: CuratedIngestAction[] = [];
    const ingestGroupId = `discord-${message.id}`;
    for (const entryData of ingestResponse.entries) {
      const result = await curateAndSaveIngestEntry(
        message.projectId,
        entryData,
        {
          defaultSources: [message.messageUrl],
          defaultDate: message.timestamp.toISOString().split('T')[0],
          ingestGroupId,
        }
      );
      createdEntries.push(result.entry);
      actions.push(result.ingestAction);

      logger.info('Curated ingest saved entry', {
        action: result.ingestAction.action,
        entryId: result.entry.id,
        title: result.entry.data.title,
        projectId: message.projectId,
        deprecatedEntryIds: result.ingestAction.deprecatedEntryIds,
      });
    }

    // Recompile KB index
    await compileKB(message.projectId);

    const finalAction =
      actions.some((action) => action.action === 'superseded') ? 'superseded'
      : actions.some((action) => action.action === 'merged') ? 'updated'
      : 'created';

    return {
      success: true,
      action: finalAction,
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
