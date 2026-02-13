import { z } from 'zod';

export const VoiceProfileSchema = z.object({
  quick_dna: z.string(),
  mechanics: z.object({
    avg_sentence_length: z.string(),
    paragraph_style: z.string(),
    punctuation_habits: z.string(),
    formatting_preferences: z.string(),
  }),
  lexicon: z.object({
    vocabulary_level: z.string(),
    signature_phrases: z.array(z.string()),
    filler_words: z.array(z.string()),
    emoji_usage: z.string(),
  }),
  rhetoric: z.object({
    opening_patterns: z.array(z.string()),
    closing_patterns: z.array(z.string()),
    argument_structure: z.string(),
    use_of_questions: z.string(),
    use_of_lists: z.string(),
  }),
  tone: z.object({
    primary: z.string(),
    secondary: z.string(),
    formality: z.string(),
    confidence_level: z.string(),
    humor_style: z.string(),
  }),
  rhythm: z.object({
    pacing: z.string(),
    sentence_variety: z.string(),
    transition_style: z.string(),
  }),
  anti_patterns: z.array(z.string()),
  reference_snippets: z.array(z.object({
    text: z.string(),
    why: z.string(),
  })),
  topics: z.object({
    primary_domains: z.array(z.string()),
    recurring_themes: z.array(z.string()),
  }),
});

export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;

export interface VoiceProfileMeta {
  handle: string;
  analyzed_at: string;
  article_count: number;
  model_used: string;
  profile: VoiceProfile;
}
