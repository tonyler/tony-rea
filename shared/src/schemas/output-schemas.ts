import { z } from 'zod';

// Feed Ingest Result - stores full original content
export const FeedIngestResultSchema = z.object({
  title: z.string(),
  full_content: z.string(),
  date_detected: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  suggested_new_tags: z.array(z.string()).nullable().optional(), // Tags not in predefined list
  sources: z.array(z.string()).nullable().optional(),
  verification_note: z.string().nullable().optional(),
  ingest_group_id: z.string().nullable().optional(),
});

export type FeedIngestResult = z.infer<typeof FeedIngestResultSchema>;

// Feed Ingest Response - LLM returns array for multi-topic splitting
export const FeedIngestResponseSchema = z.object({
  entries: z.array(FeedIngestResultSchema),
});

export type FeedIngestResponse = z.infer<typeof FeedIngestResponseSchema>;

// KB Patch Plan
export const KBPatchPlanSchema = z.object({
  action: z.enum(['supersede', 'deprecate', 'hard_delete', 'update']),
  rationale: z.string(),
  target_entry_ids: z.array(z.string()),
  new_entry: z.object({
    title: z.string(),
    full_content: z.string(),
    sources: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  kb_compilation_notes: z.string().optional(),
});

export type KBPatchPlan = z.infer<typeof KBPatchPlanSchema>;

// Retrieval Response (for RAG system)
export const RetrievalResponseSchema = z.object({
  relevant_entry_ids: z.array(z.string()),
  reasoning: z.string(),
});

export type RetrievalResponse = z.infer<typeof RetrievalResponseSchema>;

// Merge Evaluation Response - decide create vs merge for feed ingest
export const MergeEvaluationSchema = z.object({
  action: z.enum(['create', 'merge']),
  target_entry_id: z.string().nullable(),
  merged_content: z.string().nullable(),
  reasoning: z.string(),
});

export type MergeEvaluation = z.infer<typeof MergeEvaluationSchema>;

// Tag Normalization Response (LLM fuzzy-matching)
export const TagNormalizationSchema = z.object({
  mappings: z.record(z.string(), z.string()),
});

export type TagNormalizationResponse = z.infer<typeof TagNormalizationSchema>;

function parseJsonResponse(response: string): unknown {
  const trimmed = response.trim();
  const candidates: string[] = [trimmed];

  const fencedJsonMatches = Array.from(trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi));
  for (const match of fencedJsonMatches) {
    const content = match[1]?.trim();
    if (content) {
      candidates.push(content);
    }
  }

  const firstObjectStart = trimmed.indexOf('{');
  const lastObjectEnd = trimmed.lastIndexOf('}');
  if (firstObjectStart >= 0 && lastObjectEnd > firstObjectStart) {
    candidates.push(trimmed.slice(firstObjectStart, lastObjectEnd + 1).trim());
  }

  const firstArrayStart = trimmed.indexOf('[');
  const lastArrayEnd = trimmed.lastIndexOf(']');
  if (firstArrayStart >= 0 && lastArrayEnd > firstArrayStart) {
    candidates.push(trimmed.slice(firstArrayStart, lastArrayEnd + 1).trim());
  }

  let syntaxError: SyntaxError | null = null;

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    try {
      return JSON.parse(candidate);
    } catch (error) {
      if (error instanceof SyntaxError) {
        syntaxError = error;
        continue;
      }
      throw error;
    }
  }

  if (syntaxError) {
    throw syntaxError;
  }

  throw new SyntaxError('Unable to parse JSON response');
}

// Helper function to validate and parse LLM responses
export function validateLLMResponse<T>(
  schema: z.ZodSchema<T>,
  response: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    // Try to parse JSON from direct output or fenced blocks
    const parsed = parseJsonResponse(response);

    // Validate against schema
    const validated = schema.parse(parsed);

    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: `Invalid JSON: ${error.message}` };
    }
    if (error instanceof z.ZodError) {
      return { success: false, error: `Schema validation failed: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}
