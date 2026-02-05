/**
 * LLM Configuration
 *
 * Temperature guidelines:
 * - 0.3: Very consistent, minimal variation (grammar, factual extraction)
 * - 0.5: Balanced consistency (mod replies, knowledge synthesis)
 * - 0.6: Moderate creativity (education, explanations)
 * - 0.7: More creative variation (thread generation)
 */
export const llmConfig = {
  defaultModel: 'gpt-4o-mini',  // OpenAI direct (used by feed/assistant features)

  temperatures: {
    mod: 0.5,         // Consistent but natural responses
    education: 0.6,   // Some variation for teaching
    grammar: 0.3,     // Very consistent corrections
    threads: 0.7,     // Creative thread generation
    feedIngest: 0.4,  // Consistent fact extraction
    feedUpdate: 0.4,  // Consistent updates
    retrieval: 0.3,   // Consistent entry selection for RAG
  },

  maxRetries: 2,
} as const;

export type LLMMode = keyof typeof llmConfig.temperatures;
