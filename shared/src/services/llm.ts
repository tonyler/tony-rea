import OpenAI from 'openai';
import { z } from 'zod';
import { validateLLMResponse } from '../schemas/output-schemas';
import { llmConfig, type LLMMode } from '../config';

let openai: OpenAI | null = null;
let defaultModel = 'gpt-4';

export function initializeLLM(apiKey: string, model?: string) {
  openai = new OpenAI({
    apiKey: apiKey,
  });
  if (model) {
    defaultModel = model;
  }
}

export function getLLMClient(): OpenAI {
  if (!openai) {
    throw new Error('LLM service not initialized. Call initializeLLM first.');
  }
  return openai;
}

export interface LLMCallOptions {
  userPrompt: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
  mode?: LLMMode;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function shouldRetryWithoutResponseFormat(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('response_format') && message.includes('not supported');
}

export async function callLLM<T>(
  options: LLMCallOptions,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  if (!openai) {
    return { success: false, error: 'LLM service not initialized' };
  }
  const client = openai;

  const {
    userPrompt,
    systemPrompt,
    model = defaultModel,
    temperature,
    maxRetries = llmConfig.maxRetries,
    mode,
  } = options;

  // Use mode-specific temperature if mode provided, otherwise use provided temperature or default
  const finalTemperature = temperature ?? (mode ? llmConfig.temperatures[mode] : 0.7);

  let lastError = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const createCompletion = async (useResponseFormat: boolean) => client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: finalTemperature,
        ...(useResponseFormat ? { response_format: { type: 'json_object' as const } } : {}),
      });

      let response;
      try {
        response = await createCompletion(true);
      } catch (error) {
        if (!shouldRetryWithoutResponseFormat(error)) {
          throw error;
        }
        response = await createCompletion(false);
      }

      const content = response.choices[0]?.message?.content;

      if (!content) {
        lastError = 'Empty response from LLM';
        continue;
      }

      // Validate response against schema
      const validation = validateLLMResponse(schema, content);

      if (validation.success) {
        return { success: true, data: validation.data };
      }

      lastError = validation.error;

      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        console.log(`LLM validation failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError}`);
        console.log('Retrying...');
      }
    } catch (error) {
      lastError = `LLM API error: ${getErrorMessage(error)}`;

      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        console.log(`LLM call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError}`);
        console.log('Retrying...');
      }
    }
  }

  return { success: false, error: lastError || 'LLM call failed after retries' };
}

export async function callLLMRaw(
  userPrompt: string,
  systemPrompt: string,
  options?: { model?: string; temperature?: number; mode?: LLMMode }
): Promise<string> {
  if (!openai) {
    throw new Error('LLM service not initialized');
  }

  const { model, temperature, mode } = options ?? {};
  const finalTemperature = temperature ?? (mode ? llmConfig.temperatures[mode] : 0.7);

  const response = await openai.chat.completions.create({
    model: model || defaultModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: finalTemperature,
  });

  return response.choices[0]?.message?.content || '';
}
