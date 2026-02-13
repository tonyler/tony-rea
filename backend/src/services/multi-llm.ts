import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../config/env';

export type ModelProvider = 'anthropic' | 'perplexity' | 'xai';

export type ModelId =
  // Anthropic Direct (prompt caching for draft/revision)
  | 'claude-sonnet-4-5'
  // Via Perplexity v1/responses — Anthropic
  | 'claude-haiku-4-5'
  | 'claude-opus-4-5'
  // Via Perplexity v1/responses — OpenAI
  | 'gpt-5.2'
  | 'gpt-5.1'
  | 'gpt-5-mini'
  // Via Perplexity v1/responses — Google
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-3-flash'
  | 'gemini-3-pro'
  // Via Perplexity v1/responses — xAI
  | 'grok-4-1-fast'
  // xAI Direct (X/Twitter search)
  | 'grok-4-1-fast-x';

interface ModelCapabilities {
  webSearch: boolean;
  xSearch: boolean;
}

interface ModelConfig {
  provider: ModelProvider;
  modelName: string;
  pricing: { input: number; output: number }; // per 1M tokens
  capabilities: ModelCapabilities;
  fixedTemperature?: number;
}

const MODELS: Record<ModelId, ModelConfig> = {
  // Anthropic Direct — draft/revision with prompt caching
  'claude-sonnet-4-5': {
    provider: 'anthropic',
    modelName: 'claude-sonnet-4-5-20250929',
    pricing: { input: 3, output: 15 },
    capabilities: { webSearch: false, xSearch: false },
  },
  // Via Perplexity v1/responses — Anthropic
  'claude-haiku-4-5': {
    provider: 'perplexity',
    modelName: 'anthropic/claude-haiku-4-5',
    pricing: { input: 1, output: 5 },
    capabilities: { webSearch: true, xSearch: false },
  },
  'claude-opus-4-5': {
    provider: 'perplexity',
    modelName: 'anthropic/claude-opus-4-5',
    pricing: { input: 5, output: 25 },
    capabilities: { webSearch: true, xSearch: false },
  },
  // Via Perplexity v1/responses — OpenAI
  'gpt-5.2': {
    provider: 'perplexity',
    modelName: 'openai/gpt-5.2',
    pricing: { input: 1.75, output: 14 },
    capabilities: { webSearch: true, xSearch: false },
  },
  'gpt-5.1': {
    provider: 'perplexity',
    modelName: 'openai/gpt-5.1',
    pricing: { input: 1.25, output: 10 },
    capabilities: { webSearch: true, xSearch: false },
  },
  'gpt-5-mini': {
    provider: 'perplexity',
    modelName: 'openai/gpt-5-mini',
    pricing: { input: 0.25, output: 2 },
    capabilities: { webSearch: true, xSearch: false },
  },
  // Via Perplexity v1/responses — Google
  'gemini-2.5-flash': {
    provider: 'perplexity',
    modelName: 'google/gemini-2.5-flash',
    pricing: { input: 0.3, output: 2.5 },
    capabilities: { webSearch: true, xSearch: false },
  },
  'gemini-2.5-pro': {
    provider: 'perplexity',
    modelName: 'google/gemini-2.5-pro',
    pricing: { input: 1.25, output: 10 },
    capabilities: { webSearch: true, xSearch: false },
  },
  'gemini-3-flash': {
    provider: 'perplexity',
    modelName: 'google/gemini-3-flash-preview',
    pricing: { input: 0.5, output: 3 },
    capabilities: { webSearch: true, xSearch: false },
  },
  'gemini-3-pro': {
    provider: 'perplexity',
    modelName: 'google/gemini-3-pro-preview',
    pricing: { input: 2.5, output: 15 },
    capabilities: { webSearch: true, xSearch: false },
  },
  // Via Perplexity v1/responses — xAI
  'grok-4-1-fast': {
    provider: 'perplexity',
    modelName: 'xai/grok-4-1-fast-non-reasoning',
    pricing: { input: 0.2, output: 0.5 },
    capabilities: { webSearch: true, xSearch: false },
  },
  // xAI Direct — X/Twitter search
  'grok-4-1-fast-x': {
    provider: 'xai',
    modelName: 'grok-4-1-fast-non-reasoning',
    pricing: { input: 0.2, output: 0.5 },
    capabilities: { webSearch: false, xSearch: true },
  },
};

const JSON_RETRY_SUFFIX = '\n\nCRITICAL: Your previous response was not valid JSON. You MUST respond with ONLY a raw JSON object — no markdown, no code blocks, no explanatory text. Start with { and end with }.';

let anthropicClient: Anthropic | null = null;
let xaiClient: OpenAI | null = null;

export function initializeProviders(): void {
  anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  xaiClient = env.XAI_API_KEY
    ? new OpenAI({
        apiKey: env.XAI_API_KEY,
        baseURL: 'https://api.x.ai/v1',
      })
    : null;
}

export interface MultiLLMOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  useWebSearch?: boolean;
  useXSearch?: boolean;  // Enable X/Twitter search (xAI only)
  contextFiles?: ContextFile[];
}

export interface MultiLLMResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  tokens: { input: number; output: number };
  cost: number;
}

export interface ContextFile {
  name: string;
  reason: string;
  content: string;
}

function estimateTokensFromChars(chars: number): number {
  if (chars <= 0) return 0;
  return Math.max(1, Math.ceil(chars / 4));
}

export function estimateMaxCallCost(
  model: ModelId,
  inputChars: number,
  maxOutputTokens: number
): number {
  const config = MODELS[model];
  if (!config) return 0;

  const inputTokens = estimateTokensFromChars(inputChars);
  const outputTokens = Math.max(0, maxOutputTokens);

  const inputCost = (inputTokens / 1_000_000) * config.pricing.input;
  const outputCost = (outputTokens / 1_000_000) * config.pricing.output;

  return inputCost + outputCost;
}

async function callProviderRaw(
  config: ModelConfig,
  options: MultiLLMOptions,
  temperature: number,
  maxTokens: number
): Promise<{ content: string; tokens: { input: number; output: number } }> {
  switch (config.provider) {
    case 'anthropic':
      if (!anthropicClient) throw new Error('Anthropic API key not configured');
      return callAnthropic(config.modelName, options.systemPrompt, options.userPrompt, temperature, maxTokens);
    case 'perplexity':
      return callPerplexity(
        config.modelName, options.systemPrompt, options.userPrompt,
        temperature, maxTokens, options.useWebSearch, options.contextFiles
      );
    case 'xai':
      if (!xaiClient) throw new Error('xAI API key not configured');
      return callXAI(config.modelName, options.systemPrompt, options.userPrompt, temperature, maxTokens, options.useXSearch);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

export async function callMultiLLM<T>(
  model: ModelId,
  options: MultiLLMOptions,
  schema?: z.ZodSchema<T>
): Promise<MultiLLMResult<T>> {
  const config = MODELS[model];
  if (!config) {
    return { success: false, error: `Unknown model: ${model}`, tokens: { input: 0, output: 0 }, cost: 0 };
  }

  const temperature = config.fixedTemperature ?? (options.temperature ?? 0.7);
  const maxTokens = options.maxTokens ?? 4096;

  try {
    const first = await callProviderRaw(config, options, temperature, maxTokens);
    const firstCost = trackTokenCost(model, first.tokens);

    if (!schema) {
      return { success: true, data: first.content as T, tokens: first.tokens, cost: firstCost };
    }

    // Attempt 1: parse JSON from response
    const parsed = parseJsonResponse(first.content);
    if (parsed.success) {
      const validated = schema.safeParse(parsed.data);
      if (validated.success) {
        return { success: true, data: validated.data, tokens: first.tokens, cost: firstCost };
      }
      return { success: false, error: `Schema validation failed: ${validated.error.message}`, tokens: first.tokens, cost: firstCost };
    }

    // Attempt 2: retry with strict JSON enforcement prompt
    console.log(`[multi-llm] JSON parse failed for ${model}, retrying with strict JSON prompt`);
    const retryOptions = { ...options, systemPrompt: options.systemPrompt + JSON_RETRY_SUFFIX };
    const retry = await callProviderRaw(config, retryOptions, temperature, maxTokens);
    const retryCost = trackTokenCost(model, retry.tokens);
    const totalTokens = { input: first.tokens.input + retry.tokens.input, output: first.tokens.output + retry.tokens.output };
    const totalCost = firstCost + retryCost;

    const retryParsed = parseJsonResponse(retry.content);
    if (!retryParsed.success) {
      return { success: false, error: retryParsed.error, tokens: totalTokens, cost: totalCost };
    }
    const validated = schema.safeParse(retryParsed.data);
    if (!validated.success) {
      return { success: false, error: `Schema validation failed: ${validated.error.message}`, tokens: totalTokens, cost: totalCost };
    }
    return { success: true, data: validated.data, tokens: totalTokens, cost: totalCost };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage, tokens: { input: 0, output: 0 }, cost: 0 };
  }
}

async function callAnthropic(
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<{ content: string; tokens: { input: number; output: number; cacheRead?: number; cacheWrite?: number } }> {
  if (!anthropicClient) {
    throw new Error('Anthropic client not initialized');
  }

  const response = await anthropicClient.messages.create({
    model: modelName,
    max_tokens: maxTokens,
    temperature,
    // Use cache_control on system prompt for 90% input cost reduction
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    // Prefill assistant with { to force raw JSON output (no code blocks)
    messages: [
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: '{' },
    ],
  });

  if (response.stop_reason === 'max_tokens') {
    console.warn(`[multi-llm] Anthropic response truncated (max_tokens=${maxTokens}, output=${response.usage.output_tokens})`);
  }

  const textBlock = response.content.find((block: { type: string }) => block.type === 'text');
  // Prepend { since we used assistant prefill to force raw JSON
  const rawText = textBlock?.type === 'text' ? (textBlock as { type: 'text'; text: string }).text : '';
  const content = '{' + rawText;

  const usage = response.usage as {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };

  return {
    content,
    tokens: {
      input: usage.input_tokens,
      output: usage.output_tokens,
      cacheRead: usage.cache_read_input_tokens,
      cacheWrite: usage.cache_creation_input_tokens,
    },
  };
}

async function callPerplexity(
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  useWebSearch?: boolean,
  contextFiles?: ContextFile[]
): Promise<{ content: string; tokens: { input: number; output: number } }> {
  // All third-party models use /v1/responses
  // Merge context files into user prompt to keep a clean system→user message pair
  let fullUserPrompt = userPrompt;
  if (contextFiles && contextFiles.length > 0) {
    const fileSection = contextFiles.map(f =>
      `FILE: ${f.name}\nREASON: ${f.reason}\nCONTENT:\n${f.content}`
    ).join('\n\n');
    fullUserPrompt = `${fileSection}\n\n---\n\n${userPrompt}`;
  }

  const input: Array<Record<string, unknown>> = [
    { type: 'message', role: 'system', content: systemPrompt },
    { type: 'message', role: 'user', content: fullUserPrompt },
  ];

  const body: Record<string, unknown> = {
    model: modelName,
    input,
    max_output_tokens: maxTokens,
    temperature,
  };

  if (useWebSearch) {
    body.tools = [{ type: 'web_search', user_location: { country: 'US' } }];
  }

  return perplexityFetchWithRetry(
    'https://api.perplexity.ai/v1/responses',
    body,
    (data) => {
      let content = '';
      const output = data.output as Array<{ type: string; content?: Array<{ type: string; text?: string }> }> | undefined;
      if (output) {
        for (const item of output) {
          if (item.type === 'message' && item.content) {
            for (const block of item.content) {
              if (block.type === 'output_text' && block.text) {
                content += block.text;
              }
            }
          }
        }
      }

      if (!content) {
        const outputArr = data.output as Array<Record<string, unknown>> | undefined;
        if (outputArr) {
          for (const item of outputArr) {
            const blocks = item.content as Array<{ type: string; text?: string }> | undefined;
            if (blocks) {
              for (const block of blocks) {
                if (block.text) {
                  content += block.text;
                }
              }
            }
          }
        }
      }

      const usage = data.usage as { input_tokens: number; output_tokens: number } | undefined;
      return {
        content,
        tokens: {
          input: usage?.input_tokens || 0,
          output: usage?.output_tokens || 0,
        },
      };
    }
  );
}

async function perplexityFetchWithRetry(
  url: string,
  body: Record<string, unknown>,
  extractResult: (data: Record<string, unknown>) => { content: string; tokens: { input: number; output: number } }
): Promise<{ content: string; tokens: { input: number; output: number } }> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.PERPLEXITY_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseText = await response.text();

      if (responseText.trim().startsWith('<')) {
        const errMsg = `API returned HTML error page (status ${response.status})`;
        if (attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt + 1) * 1000;
          console.log(`[multi-llm] Perplexity returned HTML error, retrying in ${waitTime / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          lastError = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Failed to parse Perplexity response as JSON: ${responseText.slice(0, 200)}`);
      }

      if (!response.ok) {
        const errMsg = JSON.stringify(data).slice(0, 300);
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt + 1) * 1000;
          console.log(`[multi-llm] Perplexity error ${response.status}, retrying in ${waitTime / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          lastError = new Error(`Perplexity API error (${response.status}): ${errMsg}`);
          continue;
        }
        throw new Error(`Perplexity API error (${response.status}): ${errMsg}`);
      }

      const result = extractResult(data);

      console.log(`[multi-llm] Perplexity (${body.model}) usage: input=${result.tokens.input}, output=${result.tokens.output}`);

      if (!result.content) {
        if (attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt + 1) * 1000;
          console.warn(`[multi-llm] Perplexity (${body.model}) returned empty content, retrying in ${waitTime / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          lastError = new Error('Perplexity returned empty content');
          continue;
        }
        console.error(`[multi-llm] Perplexity (${body.model}) returned empty content after ${maxRetries} attempts. Response:`, JSON.stringify(data).slice(0, 500));
      }

      return result;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error('Perplexity API timeout (120s)');
        if (attempt < maxRetries - 1) {
          console.log(`[multi-llm] Perplexity timeout, retrying (attempt ${attempt + 1}/${maxRetries})`);
          continue;
        }
      }
      throw error;
    }
  }

  throw lastError || new Error('Perplexity API failed after retries');
}

async function callXAI(
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  useXSearch?: boolean
): Promise<{ content: string; tokens: { input: number; output: number } }> {
  if (!xaiClient) {
    throw new Error('xAI client not initialized');
  }

  // X search uses the Agent Tools API (/v1/responses)
  if (useXSearch) {
    const response = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelName,
        tools: [{
          type: 'x_search',
          from_date: getDateMonthsAgo(3),
        }],
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_output_tokens: maxTokens,
        text: { format: { type: 'json_object' } },
      }),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const errMsg = JSON.stringify(data).slice(0, 300);
      throw new Error(`xAI Agent Tools API error (${response.status}): ${errMsg}`);
    }

    // Extract text from responses API output
    let xContent = '';
    const output = data.output as Array<{ type: string; content?: Array<{ type: string; text?: string }> }> | undefined;
    if (output) {
      for (const item of output) {
        if (item.type === 'message' && item.content) {
          for (const block of item.content) {
            if (block.type === 'output_text' && block.text) {
              xContent = block.text;
            }
          }
        }
      }
    }

    if (!xContent) {
      console.error('[multi-llm] xAI x_search returned empty content. Response keys:', Object.keys(data));
    }

    const xUsage = data.usage as { input_tokens: number; output_tokens: number } | undefined;
    return {
      content: xContent,
      tokens: {
        input: xUsage?.input_tokens || 0,
        output: xUsage?.output_tokens || 0,
      },
    };
  }

  // Without search, use the OpenAI-compatible client
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await xaiClient.chat.completions.create({
    model: modelName,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '';
  const usage = response.usage;

  return {
    content,
    tokens: {
      input: usage?.prompt_tokens || 0,
      output: usage?.completion_tokens || 0,
    },
  };
}

function getDateMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}

function parseJsonResponse(content: string): { success: true; data: unknown } | { success: false; error: string } {
  try {
    let jsonStr = content.trim();

    // First, try to extract JSON from within code blocks
    // Match ```json ... ``` or ``` ... ``` patterns
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Extract JSON object between first { and last }
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    // Remove trailing commas before } or ]
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

    // First attempt: direct parse
    try {
      return { success: true, data: JSON.parse(jsonStr) };
    } catch {
      // Fall through to repair
    }

    // Second attempt: repair truncated JSON by closing open structures
    let repaired = jsonStr;
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;

    for (const ch of repaired) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
      if (ch === '[') openBrackets++;
      if (ch === ']') openBrackets--;
    }

    if (inString) repaired += '"';
    for (let i = 0; i < openBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces; i++) repaired += '}';

    // Clean up trailing partial key-value pairs
    repaired = repaired.replace(/,\s*"[^"]*"?\s*$/, '');
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    try {
      const data = JSON.parse(repaired);
      console.log('[parseJson] Repaired truncated JSON successfully');
      return { success: true, data };
    } catch {
      // Fall through
    }

    console.error('[parseJson] Failed to parse:', content.slice(0, 500));
    return { success: false, error: `JSON parse error: could not parse or repair LLM response` };
  } catch (err) {
    console.error('[parseJson] Failed to parse:', content.slice(0, 500));
    return { success: false, error: `JSON parse error: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

export function trackTokenCost(
  model: ModelId,
  tokens: { input: number; output: number; cacheRead?: number; cacheWrite?: number }
): number {
  const config = MODELS[model];
  if (!config) return 0;

  // Anthropic usage fields are separate and non-overlapping:
  // - input_tokens: uncached input (full price)
  // - cache_read_input_tokens: cached reads (10% of input price)
  // - cache_creation_input_tokens: cache writes (125% of input price)
  const cacheRead = tokens.cacheRead || 0;
  const cacheWrite = tokens.cacheWrite || 0;

  const regularInputCost = (tokens.input / 1_000_000) * config.pricing.input;
  const cacheReadCost = (cacheRead / 1_000_000) * config.pricing.input * 0.1;
  const cacheWriteCost = (cacheWrite / 1_000_000) * config.pricing.input * 1.25;
  const outputCost = (tokens.output / 1_000_000) * config.pricing.output;

  return regularInputCost + outputCost + cacheReadCost + cacheWriteCost;
}

export function getModelConfig(model: ModelId): ModelConfig | undefined {
  return MODELS[model];
}

export interface PublicModelInfo {
  id: ModelId;
  provider: ModelProvider;
  pricing: { input: number; output: number };
  capabilities: ModelCapabilities;
}

export function getAvailableModels(): PublicModelInfo[] {
  return (Object.entries(MODELS) as [ModelId, ModelConfig][]).map(([id, config]) => ({
    id,
    provider: config.provider,
    pricing: config.pricing,
    capabilities: config.capabilities,
  }));
}

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export interface BudgetTracker {
  calls: Array<{
    model: ModelId;
    tokens: TokenUsage;
    cost: number;
  }>;
  total: number;
  remaining: number;
  maxBudget: number;
}

export function createBudgetTracker(maxBudget: number = env.MAX_ARTICLE_BUDGET): BudgetTracker {
  return {
    calls: [],
    total: 0,
    remaining: maxBudget,
    maxBudget,
  };
}

export function recordCall(
  tracker: BudgetTracker,
  model: ModelId,
  tokens: TokenUsage,
  cost: number
): BudgetTracker {
  return {
    ...tracker,
    calls: [...tracker.calls, { model, tokens, cost }],
    total: tracker.total + cost,
    remaining: tracker.remaining - cost,
  };
}

export function canAffordCall(tracker: BudgetTracker, estimatedCost: number): boolean {
  return tracker.remaining >= estimatedCost;
}
