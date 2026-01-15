import OpenAI from 'openai';
import { z } from 'zod';
import { validateLLMResponse } from '../schemas/output-schemas';

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
    model = process.env.OPENAI_MODEL || 'gpt-4',
    temperature = 0.7,
    maxRetries = 1,
  } = options;

  let lastError = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      });

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
      if (error instanceof Error) {
        lastError = `LLM API error: ${error.message}`;
      } else {
        lastError = 'Unknown LLM error';
      }

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
  model?: string
): Promise<string> {
  if (!openai) {
    throw new Error('LLM service not initialized');
  }

  const response = await openai.chat.completions.create({
    model: model || process.env.OPENAI_MODEL || 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || '';
}
