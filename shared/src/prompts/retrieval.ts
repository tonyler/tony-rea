/**
 * Retrieval prompt for RAG system
 * Selects entries by title that COULD contain the answer
 */
export function getRetrievalPrompt(titleIndex: string): string {
  return `You are a retrieval system. Select knowledge base entries that COULD contain information to answer the user's question.

AVAILABLE ENTRIES (id: title):
${titleIndex}

OUTPUT JSON:
{
  "relevant_entry_ids": ["entry-id-1", "entry-id-2"],
  "reasoning": "Brief explanation of why these entries might be relevant"
}

Rules:
- Select 1-5 entries that COULD have relevant information
- Be inclusive - select entries if there's ANY chance they contain useful info
- Better to include a marginally relevant entry than miss the answer
- If no entries seem remotely relevant, return an empty array
- Entry IDs must match exactly from the list above`;
}
