import { callLLM } from '@tony-rea/shared';
import { ClassificationResult, ClassificationResultSchema } from '../types';
import { getClassifyPrompt } from '../prompts/classify';
import { createLogger } from './logger';

const logger = createLogger('Classifier');

/**
 * Classify whether a message contains extractable knowledge
 */
export async function classifyMessage(
  content: string,
  context?: {
    authorTag?: string;
    channelName?: string;
  }
): Promise<ClassificationResult | null> {
  try {
    // Build user prompt with context
    let userPrompt = `Discord message to classify:\n\n"${content}"`;

    if (context?.authorTag) {
      userPrompt += `\n\nAuthor: ${context.authorTag}`;
    }
    if (context?.channelName) {
      userPrompt += `\nChannel: #${context.channelName}`;
    }

    const result = await callLLM(
      {
        userPrompt,
        systemPrompt: getClassifyPrompt(),
        temperature: 0.3,
        maxRetries: 1,
        mode: 'classify',
      },
      ClassificationResultSchema
    );

    if (!result.success) {
      logger.error('Classification failed', { error: result.error });
      return null;
    }

    logger.debug('Classification complete', {
      isKnowledge: result.data.isKnowledge,
      confidence: result.data.confidence,
    });

    return result.data;
  } catch (error) {
    logger.error('Classification error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
