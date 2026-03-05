import OpenAI from 'openai';
import { z } from 'zod';
import { validateLLMResponse } from '../schemas/output-schemas';
import { llmConfig, type LLMMode } from '../config';

let openai: OpenAI;

export function initializeLLM(apiKey: string) {
  openai = new OpenAI({
    apiKey: apiKey,
  });
}

export interface LLMCallOptions {
  userPrompt: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
  maxTokens?: number;
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

  const {
    userPrompt,
    systemPrompt,
    model = llmConfig.defaultModel,
    temperature,
    maxRetries = llmConfig.maxRetries,
    maxTokens,
    mode,
  } = options;

  // Use mode-specific temperature if mode provided, otherwise use provided temperature or default
  const finalTemperature = temperature ?? (mode ? llmConfig.temperatures[mode] : 0.7);

  let lastError = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const createCompletion = async (useResponseFormat: boolean) => openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: finalTemperature,
        ...(useResponseFormat ? { response_format: { type: 'json_object' as const } } : {}),
        ...(maxTokens && { max_tokens: maxTokens }),
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

      // Don't retry on validation failures — the LLM returned a response,
      // retrying with the same prompt won't fix bad JSON structure
      lastError = validation.error;
      return { success: false, error: lastError };
    } catch (error) {
      lastError = `LLM API error: ${getErrorMessage(error)}`;

      // Only retry on API errors (rate limits, timeouts, network issues)
      if (attempt < maxRetries) {
        console.log(`LLM call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError}`);
      }
    }
  }

  return { success: false, error: lastError || 'LLM call failed after retries' };
}

export async function callLLMRaw(
  userPrompt: string,
  systemPrompt: string,
  options?: { model?: string; temperature?: number; mode?: LLMMode; maxTokens?: number }
): Promise<string> {
  if (!openai) {
    throw new Error('LLM service not initialized');
  }

  const { model, temperature, mode, maxTokens } = options ?? {};
  const finalTemperature = temperature ?? (mode ? llmConfig.temperatures[mode] : 0.7);

  const response = await openai.chat.completions.create({
    model: model || llmConfig.defaultModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: finalTemperature,
    ...(maxTokens && { max_tokens: maxTokens }),
  });

  return response.choices[0]?.message?.content || '';
}
