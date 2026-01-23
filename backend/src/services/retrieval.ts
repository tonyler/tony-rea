import { Entry, readKBIndex, getEntriesByIds } from './storage';
import { callLLM } from './llm';
import { RetrievalResponseSchema } from '../schemas/output-schemas';
import { getRetrievalPrompt } from '../prompts/retrieval';

const MAX_ENTRIES = 15;

export interface RetrievalResult {
  entries: Entry[];
  entryIds: string[];
  reasoning: string;
  fallback: boolean;
}

/**
 * RAG Call 1: Retrieve relevant entries for a query
 * Uses LLM to identify relevant entries from the KB index
 */
export async function retrieveRelevantEntries(
  projectId: string,
  query: string
): Promise<RetrievalResult> {
  // Read the KB index
  const kbIndex = await readKBIndex(projectId);

  // If no index exists, return empty (will fallback to full KB)
  if (!kbIndex || kbIndex.trim() === '') {
    return {
      entries: [],
      entryIds: [],
      reasoning: 'No KB index available',
      fallback: true,
    };
  }

  // Call LLM to identify relevant entries
  const result = await callLLM(
    {
      userPrompt: `User Question: ${query}`,
      systemPrompt: getRetrievalPrompt(kbIndex),
      maxRetries: 1,
      mode: 'retrieval',
    },
    RetrievalResponseSchema
  );

  if (!result.success) {
    console.error('Retrieval LLM call failed:', result.error);
    return {
      entries: [],
      entryIds: [],
      reasoning: `Retrieval failed: ${result.error}`,
      fallback: true,
    };
  }

  const { relevant_entry_ids, reasoning } = result.data;

  // Cap at MAX_ENTRIES
  const cappedIds = relevant_entry_ids.slice(0, MAX_ENTRIES);

  // Load the actual entries
  const entries = await getEntriesByIds(projectId, cappedIds);

  return {
    entries,
    entryIds: cappedIds,
    reasoning,
    fallback: false,
  };
}

/**
 * Format retrieved entries into knowledge context for Call 2
 * Returns full content of each entry with source URLs
 */
export function formatRetrievedKnowledge(entries: Entry[]): string {
  if (entries.length === 0) {
    return '';
  }

  const sections: string[] = [];

  for (const entry of entries) {
    const sources = entry.data.sources?.length ? `\nSource: ${entry.data.sources[0]}` : '';
    const date = entry.data.date_detected ? ` (${entry.data.date_detected})` : '';

    sections.push(`## ${entry.data.title}${date}\n\n${entry.data.full_content}${sources}`);
  }

  return sections.join('\n\n---\n\n');
}
