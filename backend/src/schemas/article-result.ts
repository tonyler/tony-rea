import { z } from 'zod';

export const ArticleExampleSchema = z.object({
  title: z.string(),
  content: z.string(),
  views: z.number(),
  likes: z.number(),
  score: z.number(),
  url: z.string(),
  datePosted: z.string(),
});

export type ArticleExample = z.infer<typeof ArticleExampleSchema>;

// Voice matching scores
export const VoiceScoresSchema = z.object({
  voice_match: z.number().min(0).max(10),
  writing_style: z.number().min(0).max(10),
  hooks_structure: z.number().min(0).max(10),
  engagement: z.number().min(0).max(10),
  cta: z.number().min(0).max(10),
});

export type VoiceScores = z.infer<typeof VoiceScoresSchema>;

// Quality & ethics scores
export const QualityScoresSchema = z.object({
  ai_slop: z.number().min(0).max(10),
  buzzword_density: z.number().min(0).max(10),
  human_voice: z.number().min(0).max(10),
  originality: z.number().min(0).max(10),
  honesty_signals: z.number().min(0).max(10),
  emotional_authenticity: z.number().min(0).max(10),
  specificity: z.number().min(0).max(10),
  jargon_accessibility: z.number().min(0).max(10),
  source_credibility: z.number().min(0).max(10),
  reader_respect: z.number().min(0).max(10),
  repetition_density: z.number().min(0).max(10).optional(),
});

export type QualityScores = z.infer<typeof QualityScoresSchema>;

// Verified claim with source attribution
// LLMs frequently invent enum values not in the schema, so accept any string
export const VerifiedClaimSchema = z.object({
  claim: z.string(),
  article_value: z.string().nullish(),
  verified_value: z.string().nullish(),
  source_type: z.string(),
  source_id: z.string().nullish(),
  source_url: z.string().nullish(),
  status: z.string(),
});

export type VerifiedClaim = z.infer<typeof VerifiedClaimSchema>;

// Fact check report for mandatory verification
export const FactCheckReportSchema = z.object({
  claims: z.array(VerifiedClaimSchema),
  summary: z.object({
    total: z.number(),
    verified_kb: z.number(),
    verified_web: z.number(),
    mismatches: z.number(),
    unverified: z.number(),
  }),
});

export type FactCheckReport = z.infer<typeof FactCheckReportSchema>;

// Flagged phrase for specific issues
export const FlaggedPhraseSchema = z.object({
  phrase: z.string(),
  issue: z.string(),
  fix: z.string(),
});

export type FlaggedPhrase = z.infer<typeof FlaggedPhraseSchema>;

export const JudgeIssueSchema = z.object({
  dimension: z.string(),
  score: z.number(),
  fix: z.string(),
});

export type JudgeIssue = z.infer<typeof JudgeIssueSchema>;

// Judge opinion with quality/ethics scores only (no voice matching)
export const JudgeOpinionSchema = z.object({
  judge: z.string(),
  round: z.number(),
  quality_scores: QualityScoresSchema,
  overall: z.number().min(0).max(10),
  flagged_phrases: z.array(FlaggedPhraseSchema).max(6),
  top_issues: z.array(JudgeIssueSchema).max(4),
  verdict: z.enum(['APPROVE', 'REVISE', 'REJECT']),
  reasoning: z.string(),
  fact_check_report: FactCheckReportSchema.optional(),
});

export type JudgeOpinion = z.infer<typeof JudgeOpinionSchema>;

// Legacy schema for backward compatibility (deprecated)
export const JudgeScoresSchema = z.object({
  voice_match: z.number().min(0).max(10),
  writing_style: z.number().min(0).max(10),
  hooks_structure: z.number().min(0).max(10),
  virality: z.number().min(0).max(10).optional(),
  info_validity: z.number().min(0).max(10).optional(),
  specificity: z.number().min(0).max(10),
  engagement: z.number().min(0).max(10),
  cta: z.number().min(0).max(10),
  originality: z.number().min(0).max(10),
  algo_safety: z.number().min(0).max(10).optional(),
  readability: z.number().min(0).max(10).optional(),
  overall: z.number().min(0).max(10),
});

export type JudgeScores = z.infer<typeof JudgeScoresSchema>;

export const PriorityFixSchema = z.object({
  fix: z.string(),
  priority: z.number(),
  votes: z.number(),
});

export type PriorityFix = z.infer<typeof PriorityFixSchema>;

export const DebateRoundSchema = z.object({
  round: z.number(),
  opinions: z.record(z.string(), JudgeOpinionSchema),
  avg_scores: z.record(z.string(), z.number()),
  consensus_fixes: z.array(z.string()),
  priority_fixes: z.array(PriorityFixSchema),
});

export type DebateRound = z.infer<typeof DebateRoundSchema>;

export const BudgetTrackerSchema = z.object({
  calls: z.array(z.object({
    model: z.string(),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
    }),
    cost: z.number(),
  })),
  total: z.number(),
  remaining: z.number(),
  maxBudget: z.number(),
});

export type BudgetTrackerType = z.infer<typeof BudgetTrackerSchema>;

export const ArticleResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  wordCount: z.number(),
  earlyStop: z.boolean().optional(),
  projectId: z.string().optional(),
  debate: z.object({
    r1: DebateRoundSchema,
    r2: DebateRoundSchema.nullable(),
  }),
  budget: BudgetTrackerSchema,
  exampleArticles: z.array(ArticleExampleSchema),
  initialDraft: z.object({ title: z.string(), content: z.string() }).optional(),
  warnings: z.array(z.string()).optional(),
  createdAt: z.string(),
});

export type ArticleResult = z.infer<typeof ArticleResultSchema>;

export const ArticleSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  wordCount: z.number(),
  overallScore: z.number(),
  budgetUsed: z.number(),
  createdAt: z.string(),
});

export type ArticleSummary = z.infer<typeof ArticleSummarySchema>;

// =============================================================================
// ETHICS REVIEW SCHEMAS
// =============================================================================

// Standalone ethics review schema (uses QualityScoresSchema + overall)
export const EthicsReviewSchema = z.object({
  scores: QualityScoresSchema.extend({ overall: z.number().min(0).max(10) }),
  flagged_phrases: z.array(FlaggedPhraseSchema).max(6),
  strengths: z.array(z.string()),
  verdict: z.enum(['PASS', 'NEEDS_WORK', 'FAIL']),
  summary: z.string(),
});

export type EthicsReview = z.infer<typeof EthicsReviewSchema>;

export const EthicsReviewResultSchema = z.object({
  judge: z.string(),
  review: EthicsReviewSchema,
});

export type EthicsReviewResult = z.infer<typeof EthicsReviewResultSchema>;
