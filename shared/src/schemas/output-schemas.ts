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

// Helper function to validate and parse LLM responses
export function validateLLMResponse<T>(
  schema: z.ZodSchema<T>,
  response: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    // Try to parse JSON
    const parsed = JSON.parse(response);

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
