export interface QualityScores {
  ai_slop: number;
  buzzword_density: number;
  human_voice: number;
  originality: number;
  honesty_signals: number;
  emotional_authenticity: number;
  specificity: number;
  jargon_accessibility: number;
  source_credibility: number;
  reader_respect: number;
  repetition_density?: number;
}

export interface VerifiedClaim {
  claim: string;
  article_value: string | null | undefined;
  verified_value: string | null | undefined;
  source_type: string;  // Backend may return unexpected values from LLMs
  source_id?: string | null;
  source_url?: string | null;
  status: string;  // Backend may return unexpected values from LLMs
}

export interface FactCheckReport {
  claims: VerifiedClaim[];
  summary: {
    total: number;
    verified_kb: number;
    verified_web: number;
    mismatches: number;
    unverified: number;
  };
}

export interface FlaggedPhrase {
  phrase: string;
  issue: string;
  fix: string;
}

export interface JudgeIssue {
  dimension: string;
  score: number;
  fix: string;
}

export interface JudgeOpinion {
  judge: string;
  round: number;
  quality_scores: QualityScores;
  overall: number;
  flagged_phrases: FlaggedPhrase[];
  top_issues: JudgeIssue[];
  verdict: 'APPROVE' | 'REVISE' | 'REJECT';
  reasoning: string;
  fact_check_report?: FactCheckReport;
}

export interface PriorityFix {
  fix: string;
  priority: number;
  votes: number;
}

export interface DebateRound {
  round: number;
  opinions: Record<string, JudgeOpinion>;
  avg_scores: Record<string, number>;
  consensus_fixes: string[];
  priority_fixes: PriorityFix[];
}

export interface BudgetTracker {
  calls: Array<{
    model: string;
    tokens: { input: number; output: number };
    cost: number;
  }>;
  total: number;
  remaining: number;
  maxBudget: number;
}

export interface ScrapedArticle {
  title: string;
  content: string;
  views: number;
  likes: number;
  score: number;
  url: string;
  datePosted: string;
}

export interface VoiceSummary {
  handle: string;
  scraped_at: string;
  article_count: number;
  top_article_count: number;
  has_profile?: boolean;
  articles?: ScrapedArticle[];
}

export interface VoiceProfileMeta {
  handle: string;
  analyzed_at: string;
  article_count: number;
  model_used: string;
  profile: Record<string, unknown>;
}

export interface ArticleResult {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  earlyStop?: boolean;
  projectId?: string;
  debate: {
    r1: DebateRound;
    r2: DebateRound | null;
  };
  budget: BudgetTracker;
  exampleArticles?: ScrapedArticle[];
  initialDraft?: { title: string; content: string };
  warnings?: string[];
  createdAt: string;
}

export type ModelId =
  | 'claude-sonnet-4-6'  // Anthropic Direct (prompt caching)
  | 'claude-opus-4-6'    // via Perplexity
  | 'claude-haiku-4-5'   // via Perplexity
  | 'claude-opus-4-5'    // via Perplexity
  | 'gpt-5.2'            // via Perplexity
  | 'gpt-5.1'            // via Perplexity
  | 'gpt-5-mini'         // via Perplexity
  | 'grok-4-1-fast'      // via Perplexity
  | 'grok-4-1-fast-x'   // xAI Direct (X search)
  | 'sonar'              // Perplexity Sonar Direct (built-in web search)
  | 'gemini-3.1-pro'     // via OpenRouter
  | 'gemini-2.5-flash'   // via OpenRouter
  | 'gemini-2.5-pro'     // via OpenRouter
  | 'gemini-3-flash'     // via OpenRouter
  | 'gemini-3-pro'       // via OpenRouter
  | 'gemini-flash'       // via OpenRouter
  | 'mistral-creative'   // via OpenRouter
  | 'kimi-k2-thinking'   // via OpenRouter
  | 'kimi-k2.5';         // via OpenRouter
export type SearchMode = 'full' | 'none' | 'web-only' | 'x-only';
export type CouncilMode = 'skip' | 'standard';
export type JudgeRole = 'fact-checker' | 'slop-detector' | 'originality-reviewer' | 'rules-enforcer';

export interface JudgeSelection {
  model: ModelId;
  role: JudgeRole;
}

export interface LLMConfig {
  draftModel: ModelId;
  revisionModel: ModelId | 'auto';
  searchMode: SearchMode;
  councilMode: CouncilMode;
  judges: JudgeSelection[];
  maxTokens: number;
}

export interface ArticleSummary {
  id: string;
  title: string;
  wordCount: number;
  overallScore: number;
  budgetUsed: number;
  createdAt: string;
}
