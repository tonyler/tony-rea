import { z } from 'zod';
import {
  JudgeOpinion,
  DebateRound,
  PriorityFix,
  QualityScoresSchema,
  FlaggedPhraseSchema,
  JudgeIssueSchema,
  FactCheckReportSchema,
} from '../schemas/article-result';
import {
  callMultiLLM,
  BudgetTracker,
  recordCall,
  ModelId,
  getModelConfig,
  ContextFile,
} from './multi-llm';
import { getJudgeR1Prompt } from '../prompts/articles';
import type { VoiceProfile } from '../schemas/voice-profile';
import { formatRetrievedKnowledge } from './retrieval';
import { readKBIndex, getEntriesByIds } from './storage';
import { RetrievalResponseSchema } from '../schemas/output-schemas';
import { getRetrievalPrompt } from '../prompts/retrieval';

export type JudgeRole = 'fact-checker' | 'slop-detector' | 'originality-reviewer' | 'rules-enforcer';
export type SearchMode = 'full' | 'none' | 'web-only' | 'x-only';

export interface JudgeConfig {
  model: ModelId;
  role: JudgeRole;
  label: string;
  useWebSearch: boolean;
  useXSearch: boolean;
}

const AI_SLOP_HARD_REJECT_THRESHOLD = 5;
const REPETITION_REJECT_THRESHOLD = 5;
const SKIP_REVISION_THRESHOLD = 9.0;

const DIMENSION_MINIMUMS: Record<string, number> = {
  ai_slop: 5,
  source_credibility: 5,
  repetition_density: 5,
  human_voice: 4,
};

interface CouncilResult {
  r1: DebateRound;
  r2: null;
  budget: BudgetTracker;
  earlyStop: boolean;
  skipFinalRevision: boolean;
  allFlaggedPhrases: Array<{ phrase: string; issue: string; fix: string; judge: string }>;
  warnings: string[];
}

export type ProgressCallback = (message: string) => void;

export interface CouncilOptions {
  projectId?: string;
  judges?: JudgeConfig[];
  searchMode?: SearchMode;
  judgeConfigWarnings?: string[];
  onProgress?: ProgressCallback;
  voiceProfile?: VoiceProfile;
}

export function getDefaultJudges(searchMode: SearchMode = 'full'): JudgeConfig[] {
  return [
    {
      model: 'grok-4-1-fast-x',  // xAI Direct — X/Twitter search for data verification
      role: 'fact-checker',
      label: 'grok-facts',
      useWebSearch: false,
      useXSearch: searchMode === 'full' || searchMode === 'x-only',
    },
    {
      model: 'sonar',  // Perplexity Sonar — built-in web search for fact-checking
      role: 'fact-checker',
      label: 'sonar-facts',
      useWebSearch: true,
      useXSearch: false,
    },
    {
      model: 'gemini-flash',  // Via OpenRouter — cheap + fast slop/AI pattern detection
      role: 'slop-detector',
      label: 'gemini-slop',
      useWebSearch: false,
      useXSearch: false,
    },
    {
      model: 'mistral-creative',  // Via OpenRouter — creative writing analysis
      role: 'originality-reviewer',
      label: 'mistral-originality',
      useWebSearch: false,
      useXSearch: false,
    },
  ];
}

export function buildJudgeConfigs(
  judges: Array<{ model: ModelId; role: JudgeRole }>,
  searchMode: SearchMode
): { configs: JudgeConfig[]; warnings: string[] } {
  const warnings: string[] = [];

  const configs = judges.map((j) => {
    const modelCfg = getModelConfig(j.model);
    const caps = modelCfg?.capabilities ?? { webSearch: false, xSearch: false };

    let useWebSearch = false;
    let useXSearch = false;

    if (j.role === 'slop-detector') {
      // Slop detector should never use web/X search. Keep it focused on style/voice only.
      return {
        model: j.model,
        role: j.role,
        label: j.model,
        useWebSearch: false,
        useXSearch: false,
      };
    }

    if (searchMode !== 'none') {
      const wantsWeb = searchMode === 'full' || searchMode === 'web-only';
      const wantsX = searchMode === 'full' || searchMode === 'x-only';

      if (wantsWeb && caps.webSearch) {
        useWebSearch = true;
      }
      if (wantsX && caps.xSearch) {
        useXSearch = true;
      }

      if (j.role === 'fact-checker') {
        if (searchMode === 'web-only' && !caps.webSearch) {
          warnings.push(`web search unavailable for ${j.model}, using KB only`);
        } else if (searchMode === 'x-only' && !caps.xSearch) {
          warnings.push(`X search unavailable for ${j.model}, using KB only`);
        } else if (searchMode === 'full' && !useWebSearch && !useXSearch) {
          warnings.push(`web/X search unavailable for ${j.model}, using KB only`);
        }
      }
    }

    return {
      model: j.model,
      role: j.role,
      label: j.model,
      useWebSearch,
      useXSearch,
    };
  });

  return { configs, warnings };
}

export async function runCouncil(
  article: string,
  budget: BudgetTracker,
  options: CouncilOptions = {}
): Promise<CouncilResult> {
  const { projectId, searchMode = 'full', judgeConfigWarnings, onProgress, voiceProfile } = options;
  const warnings: string[] = [...(judgeConfigWarnings ?? [])];
  const judges = options.judges ?? getDefaultJudges(searchMode);
  const minJudgesRequired = Math.min(judges.length, 2);

  console.log(`[council] Starting council evaluation with ${judges.length} judges...${projectId ? ' (per-judge KB retrieval)' : ''}${voiceProfile ? ' (voice profile active)' : ''}`);

  const r1Start = Date.now();
  const r1Result = await runJudgeRound(article, budget, judges, projectId, onProgress, voiceProfile);
  console.log(`[council] Completed in ${((Date.now() - r1Start) / 1000).toFixed(1)}s`);

  if (!r1Result.success && r1Result.judgeCount < minJudgesRequired) {
    // If at least 1 judge succeeded, proceed with warnings instead of failing
    if (r1Result.judgeCount >= 1) {
      const msg = `Only ${r1Result.judgeCount}/${minJudgesRequired} council judges completed; evaluation proceeds with reduced coverage.`;
      console.warn(`[council] ${msg}`);
      warnings.push(msg);
    } else {
      throw new Error(`Council failed: insufficient judges (${r1Result.judgeCount}/${minJudgesRequired})`);
    }
  }

  const r1 = r1Result.round;
  const allFlaggedPhrases = collectFlaggedPhrases(r1.opinions);

  const avgOverall = r1.avg_scores['overall'] || 0;
  const avgAiSlop = r1.avg_scores['ai_slop'] || 0;
  const avgRepetition = r1.avg_scores['repetition_density'] || 10;
  const allApprove = Object.values(r1.opinions).every((o) => o.verdict === 'APPROVE');
  const minimumFailures = checkMinimumScores(r1.avg_scores);

  let skipFinalRevision = false;

  if (avgAiSlop < AI_SLOP_HARD_REJECT_THRESHOLD) {
    console.log(`[council] ai_slop=${avgAiSlop.toFixed(1)} < ${AI_SLOP_HARD_REJECT_THRESHOLD} — revision required`);
  } else if (avgRepetition < REPETITION_REJECT_THRESHOLD) {
    console.log(`[council] repetition=${avgRepetition.toFixed(1)} < ${REPETITION_REJECT_THRESHOLD} — revision required`);
  } else if (minimumFailures.length > 0) {
    console.log(`[council] minimum score failures: ${minimumFailures.join(', ')} — revision required`);
  } else if (allApprove && avgOverall >= SKIP_REVISION_THRESHOLD) {
    console.log(`[council] avg=${avgOverall.toFixed(1)}, all APPROVEs — skipping revision`);
    skipFinalRevision = true;
  } else {
    console.log(`[council] avg=${avgOverall.toFixed(1)}, approved=${Object.values(r1.opinions).filter(o => o.verdict === 'APPROVE').length}/${Object.keys(r1.opinions).length} — revision required`);
  }

  return {
    r1,
    r2: null,
    budget: r1Result.budget,
    earlyStop: skipFinalRevision,
    skipFinalRevision,
    allFlaggedPhrases,
    warnings,
  };
}

function collectFlaggedPhrases(
  opinions: Record<string, JudgeOpinion>
): Array<{ phrase: string; issue: string; fix: string; judge: string }> {
  const result: Array<{ phrase: string; issue: string; fix: string; judge: string }> = [];

  for (const [judgeName, opinion] of Object.entries(opinions)) {
    if (opinion.flagged_phrases) {
      for (const fp of opinion.flagged_phrases) {
        result.push({
          phrase: fp.phrase,
          issue: fp.issue,
          fix: fp.fix,
          judge: judgeName,
        });
      }
    }
  }

  return result;
}

function checkMinimumScores(avg_scores: Record<string, number>): string[] {
  const failures: string[] = [];
  for (const [dim, min] of Object.entries(DIMENSION_MINIMUMS)) {
    const score = avg_scores[dim];
    if (score !== undefined && score < min) {
      failures.push(`${dim} (${score.toFixed(1)} < ${min})`);
    }
  }
  return failures;
}

interface RoundResult {
  success: boolean;
  round: DebateRound;
  budget: BudgetTracker;
  judgeCount: number;
}

const JudgeResponseSchema = z.object({
  quality_scores: QualityScoresSchema,
  overall: z.number().min(0).max(10),
  flagged_phrases: z.array(FlaggedPhraseSchema).max(6).optional().default([]),
  top_issues: z.array(JudgeIssueSchema).max(4),
  verdict: z.enum(['APPROVE', 'REVISE', 'REJECT']),
  reasoning: z.string(),
  fact_check_report: FactCheckReportSchema,
});

const MODEL_LABELS: Record<string, string> = {
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-opus-4-5': 'Claude Opus 4.5',
  'gpt-5.2': 'GPT-5.2',
  'gpt-5.1': 'GPT-5.1',
  'gpt-5-mini': 'GPT-5 Mini',
  'gemini-3.1-pro': 'Gemini 3.1 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-3-flash': 'Gemini 3 Flash',
  'gemini-3-pro': 'Gemini 3 Pro',
  'grok-4-1-fast': 'Grok 4.1',
  'grok-4-1-fast-x': 'Grok 4.1',
  'sonar': 'Sonar',
  'gemini-flash': 'Gemini Flash',
  'mistral-creative': 'Mistral Creative',
};

const ROLE_ACTIONS: Record<string, string> = {
  'fact-checker': 'fact-checking',
  'slop-detector': 'scanning for AI slop',
  'originality-reviewer': 'reviewing originality',
  'rules-enforcer': 'enforcing editorial rules',
};

function judgeProgressMessage(judge: JudgeConfig): string {
  const name = MODEL_LABELS[judge.model] || judge.model;
  const action = ROLE_ACTIONS[judge.role] || judge.role;
  const suffix = judge.useXSearch ? ' via X' : judge.useWebSearch ? ' with web search' : '';
  return `${name} is ${action}${suffix}`;
}

async function runJudgeRound(
  article: string,
  budget: BudgetTracker,
  judges: JudgeConfig[],
  projectId?: string,
  onProgress?: ProgressCallback,
  voiceProfile?: VoiceProfile
): Promise<RoundResult> {
  const kbIndex = projectId ? await readKBIndex(projectId) : '';

  // Split judges into groups: only Perplexity-proxied judges run sequentially (429 rate limits)
  // xAI, OpenRouter, and Perplexity Sonar can run in parallel
  const perplexityJudges = judges.filter(j => {
    const cfg = getModelConfig(j.model);
    return cfg?.provider === 'perplexity';
  });
  const nonPerplexityJudges = judges.filter(j => {
    const cfg = getModelConfig(j.model);
    return cfg?.provider !== 'perplexity';
  });

  const opinions: Record<string, JudgeOpinion> = {};
  let currentBudget = budget;
  const minRequired = Math.min(judges.length, 2);

  const JUDGE_TIMEOUT_WEB_SEARCH = 300_000; // 5 min for web/X search judges
  const JUDGE_TIMEOUT_DEFAULT = 180_000;     // 3 min for non-search judges

  type JudgeOutcome = { judge: JudgeConfig; result: JudgeResult | null };

  async function runJudgeWithTimeout(judge: JudgeConfig): Promise<JudgeOutcome> {
    const usesSearch = judge.useWebSearch || judge.useXSearch;
    const timeoutMs = usesSearch ? JUDGE_TIMEOUT_WEB_SEARCH : JUDGE_TIMEOUT_DEFAULT;

    let timeoutId: ReturnType<typeof setTimeout>;
    const judgePromise = judgeArticle(judge, article, currentBudget, projectId, kbIndex, voiceProfile);
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Judge ${judge.label} timed out after ${timeoutMs / 1000}s`)), timeoutMs);
    });

    try {
      const result = await Promise.race([judgePromise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return { judge, result };
    } catch (error) {
      clearTimeout(timeoutId!);
      const msg = error instanceof Error ? error.message : 'unknown error';
      console.error(`[council] Judge ${judge.label} timeout/error: ${msg}`);
      return { judge, result: null };
    }
  }

  // Run non-Perplexity judges in parallel with sequential Perplexity judges
  // Collect all results first, then apply sequentially to avoid race conditions on shared state
  const perplexityPromise = (async (): Promise<JudgeOutcome[]> => {
    const results: JudgeOutcome[] = [];
    for (const judge of perplexityJudges) {
      onProgress?.(judgeProgressMessage(judge));
      results.push(await runJudgeWithTimeout(judge));
    }
    return results;
  })();

  const nonPerplexityPromises = nonPerplexityJudges.map(async (judge): Promise<JudgeOutcome> => {
    onProgress?.(judgeProgressMessage(judge));
    return runJudgeWithTimeout(judge);
  });

  const [perplexityResults, ...nonPerplexityResults] = await Promise.all([perplexityPromise, ...nonPerplexityPromises]);

  // Apply results sequentially — no race condition on opinions/budget
  for (const { judge, result } of [...perplexityResults, ...nonPerplexityResults]) {
    if (result?.success) {
      opinions[judge.label] = result.opinion;
      currentBudget = recordCall(currentBudget, judge.model, result.tokens, result.cost);
    } else if (result) {
      console.error(`[council] Judge ${judge.label} failed: ${result.error}`);
    }
  }

  const judgeCount = Object.keys(opinions).length;

  return {
    success: judgeCount >= minRequired,
    round: mergeDebateRound(opinions),
    budget: currentBudget,
    judgeCount,
  };
}

interface JudgeResult {
  success: boolean;
  opinion: JudgeOpinion;
  tokens: { input: number; output: number };
  cost: number;
  error?: string;
}

async function judgeArticle(
  judge: JudgeConfig,
  article: string,
  _budget: BudgetTracker,
  projectId?: string,
  kbIndex?: string,
  voiceProfile?: VoiceProfile
): Promise<JudgeResult> {
  const startTime = Date.now();

  const kbKnowledge = await loadJudgeKbKnowledge(projectId, kbIndex, judge, article);

  const prompt = getJudgeR1Prompt(judge.role, judge.label, article, kbKnowledge, {
    useWebSearch: judge.useWebSearch,
    profile: voiceProfile,
  });

  const hasKB = !!kbKnowledge;
  const usesTools = judge.useWebSearch || judge.useXSearch;
  // Increased token limits to prevent response truncation
  const maxTokens = usesTools ? 16384 : (hasKB ? 12288 : 10240);

  const contextFiles = kbKnowledge ? buildKbContextFiles(kbKnowledge) : undefined;
  const result = await callMultiLLM(judge.model, {
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    temperature: 0.3,
    maxTokens,
    useWebSearch: judge.useWebSearch,
    useXSearch: judge.useXSearch,
    contextFiles,
  }, JudgeResponseSchema);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[council] ${judge.label} (${judge.role}) completed in ${elapsed}s (${result.success ? 'ok' : 'failed'})`);

  if (!result.success || !result.data) {
    return {
      success: false,
      opinion: {} as JudgeOpinion,
      tokens: result.tokens,
      cost: result.cost,
      error: result.error,
    };
  }

  return {
    success: true,
    opinion: {
      judge: judge.label,
      round: 1,
      quality_scores: result.data.quality_scores,
      overall: result.data.overall,
      flagged_phrases: result.data.flagged_phrases || [],
      top_issues: result.data.top_issues,
      verdict: result.data.verdict,
      reasoning: result.data.reasoning,
      fact_check_report: result.data.fact_check_report,
    },
    tokens: result.tokens,
    cost: result.cost,
  };
}

const MAX_RETRIEVAL_CHARS = 4000;

async function loadJudgeKbKnowledge(
  projectId: string | undefined,
  kbIndex: string | undefined,
  judge: JudgeConfig,
  article: string
): Promise<string | undefined> {
  if (!projectId || !kbIndex || kbIndex.trim() === '') {
    return undefined;
  }

  const snippet = article.length > MAX_RETRIEVAL_CHARS
    ? `${article.slice(0, MAX_RETRIEVAL_CHARS)}\n...[truncated]`
    : article;

  const query = `Judge role: ${judge.role}\nJudge label: ${judge.label}\n\nArticle to review:\n${snippet}`;

  const retrievalPrompt = getRetrievalPrompt(kbIndex);
  const retrievalResult = await callMultiLLM(judge.model, {
    systemPrompt: retrievalPrompt,
    userPrompt: query,
    temperature: 0.2,
    maxTokens: 512,
    useWebSearch: false,
    useXSearch: false,
  }, RetrievalResponseSchema);

  if (!retrievalResult.success || !retrievalResult.data) {
    return undefined;
  }

  const selectedIds = retrievalResult.data.relevant_entry_ids || [];
  if (selectedIds.length === 0) {
    return undefined;
  }

  const entries = await getEntriesByIds(projectId, selectedIds);
  if (entries.length === 0) {
    return undefined;
  }

  return formatRetrievedKnowledge(entries);
}

function buildKbContextFiles(kbKnowledge: string): ContextFile[] {
  const sections = kbKnowledge
    .split('\n\n---\n\n')
    .map((s) => s.trim())
    .filter(Boolean);

  return sections.map((section, index) => {
    const firstLine = section.split('\n')[0] ?? '';
    let title = firstLine.replace(/^##\s*/, '').trim();
    title = title.replace(/\s*\([^)]*\)\s*$/, '').trim();

    const slug = slugifyForFilename(title);
    const name = slug ? `kb/${slug}.md` : `kb/entry-${index + 1}.md`;

    return {
      name,
      reason: 'Verified KB entry for fact-checking. Prefer over web sources.',
      content: section,
    };
  });
}

function slugifyForFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function mergeDebateRound(
  opinions: Record<string, JudgeOpinion>
): DebateRound {
  const opinionList = Object.values(opinions);
  if (opinionList.length === 0) {
    return {
      round: 1,
      opinions: {},
      avg_scores: {},
      consensus_fixes: [],
      priority_fixes: [],
    };
  }

  const qualityKeys: (keyof typeof opinionList[0]['quality_scores'])[] = [
    'ai_slop', 'buzzword_density', 'human_voice', 'originality',
    'honesty_signals', 'emotional_authenticity', 'specificity',
    'jargon_accessibility', 'source_credibility', 'reader_respect',
    'repetition_density',
  ];

  const avg_scores: Record<string, number> = {};

  for (const key of qualityKeys) {
    const values = opinionList
      .filter(o => o.quality_scores && o.quality_scores[key] !== undefined)
      .map(o => o.quality_scores[key] as number);
    if (values.length > 0) {
      avg_scores[key] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  const overallValues = opinionList.filter(o => o.overall !== undefined).map(o => o.overall);
  const judgeOverall = overallValues.length > 0
    ? overallValues.reduce((a, b) => a + b, 0) / overallValues.length
    : 0;

  const weights: Record<string, number> = {
    ai_slop: 3,
    source_credibility: 3,
    repetition_density: 2,
    human_voice: 2,
    originality: 2,
    buzzword_density: 1.5,
    honesty_signals: 1,
    emotional_authenticity: 1,
    specificity: 1,
    jargon_accessibility: 0.5,
    reader_respect: 0.5,
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (avg_scores[key] !== undefined) {
      weightedSum += avg_scores[key] * weight;
      totalWeight += weight;
    }
  }

  const weightedOverall = totalWeight > 0 ? weightedSum / totalWeight : 0;
  avg_scores['overall'] = weightedOverall;
  avg_scores['weighted_overall'] = weightedOverall;
  avg_scores['judge_overall'] = judgeOverall;

  const fixCounts: Record<string, number> = {};
  for (const opinion of opinionList) {
    for (const issue of opinion.top_issues) {
      const key = issue.fix.toLowerCase();
      fixCounts[key] = (fixCounts[key] || 0) + 1;
    }
  }

  const consensus_fixes = Object.entries(fixCounts)
    .filter(([_, count]) => count >= 2)
    .map(([fix]) => fix);

  const fixMap: Map<string, { votes: number; totalScore: number }> = new Map();
  for (const opinion of opinionList) {
    for (const issue of opinion.top_issues) {
      const key = issue.fix.toLowerCase();
      const existing = fixMap.get(key) || { votes: 0, totalScore: 0 };
      fixMap.set(key, {
        votes: existing.votes + 1,
        totalScore: existing.totalScore + (10 - issue.score),
      });
    }
  }

  const priority_fixes: PriorityFix[] = Array.from(fixMap.entries())
    .map(([fix, data]) => ({
      fix,
      priority: Math.round((data.totalScore / data.votes) * data.votes),
      votes: data.votes,
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);

  return {
    round: 1,
    opinions,
    avg_scores,
    consensus_fixes,
    priority_fixes,
  };
}
