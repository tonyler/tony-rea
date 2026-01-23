/**
 * Shared LLM Configuration
 *
 * Temperature guidelines:
 * - 0.3: Very consistent, minimal variation (grammar, factual extraction)
 * - 0.4: Consistent extraction/classification
 * - 0.5: Balanced consistency (mod replies, knowledge synthesis)
 * - 0.6: Moderate creativity (education, explanations)
 * - 0.7: More creative variation (thread generation)
 */
export const llmConfig = {
  temperatures: {
    feedIngest: 0.4,    // Consistent fact extraction
    feedUpdate: 0.4,    // Consistent updates
    classify: 0.3,      // Very consistent classification
    retrieval: 0.3,     // Consistent entry selection for RAG
  },

  maxRetries: 2,
} as const;

export type LLMMode = keyof typeof llmConfig.temperatures;

// Export tags configuration
export * from './tags';
