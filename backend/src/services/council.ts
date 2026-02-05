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

export interface CouncilOptions {
  kbKnowledge?: string;
  judges?: JudgeConfig[];
  searchMode?: SearchMode;
}

export function getDefaultJudges(searchMode: SearchMode = 'full'): JudgeConfig[] {
  return [
    {
      model: 'sonar',  // Perplexity native, cheap web search
      role: 'fact-checker',
      label: 'sonar',
      useWebSearch: searchMode === 'full' || searchMode === 'web-only',
      useXSearch: false,
    },
    {
      model: 'gemini-2.5-flash',  // Via Perplexity, cheap, good at patterns
      role: 'originality-reviewer',
      label: 'gemini-2.5-flash',
      useWebSearch: false,
      useXSearch: false,
    },
    {
      model: 'grok-4-1-fast-x',  // xAI Direct - ONLY way to get X search
      role: 'slop-detector',
      label: 'grok-4-1-fast-x',
      useWebSearch: false,
      useXSearch: searchMode === 'full' || searchMode === 'x-only',
    },
    {
      model: 'gemini-2.5-flash',  // Via Perplexity, cheap, good at rules
      role: 'rules-enforcer',
      label: 'rules-enforcer',
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
      if (searchMode === 'full' || searchMode === 'web-only') {
        if (caps.webSearch) {
          useWebSearch = true;
        } else if (j.role === 'fact-checker') {
          warnings.push(`web search unavailable for ${j.model}, using KB only`);
        }
      }
      if (searchMode === 'full' || searchMode === 'x-only') {
        if (caps.xSearch) {
          useXSearch = true;
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
  const { kbKnowledge, searchMode = 'full' } = options;
  const judges = options.judges ?? getDefaultJudges(searchMode);
  const minJudgesRequired = Math.min(judges.length, 2);

  console.log(`[council] Starting council evaluation with ${judges.length} judges...${kbKnowledge ? ' (with KB facts)' : ''}`);

  const r1Start = Date.now();
  const r1Result = await runJudgeRound(article, budget, judges, kbKnowledge);
  console.log(`[council] Completed in ${((Date.now() - r1Start) / 1000).toFixed(1)}s`);

  if (!r1Result.success && r1Result.judgeCount < minJudgesRequired) {
    throw new Error(`Council failed: insufficient judges (${r1Result.judgeCount}/${minJudgesRequired})`);
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
    warnings: [],
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

async function runJudgeRound(
  article: string,
  budget: BudgetTracker,
  judges: JudgeConfig[],
  kbKnowledge?: string
): Promise<RoundResult> {
  const judgePromises = judges.map((judge) => {
    // Judges with search capabilities don't need KB context
    const hasSearch = judge.useWebSearch || judge.useXSearch;
    const judgeKb = hasSearch ? undefined : kbKnowledge;
    return judgeArticle(judge, article, budget, judgeKb);
  });

  const results = await Promise.allSettled(judgePromises);

  const opinions: Record<string, JudgeOpinion> = {};
  let currentBudget = budget;
  const minRequired = Math.min(judges.length, 2);

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const judgeLabel = judges[i].label;

    if (result.status === 'fulfilled' && result.value.success) {
      opinions[judgeLabel] = result.value.opinion;
      currentBudget = recordCall(
        currentBudget,
        judges[i].model,
        result.value.tokens,
        result.value.cost
      );
    } else {
      const error = result.status === 'rejected' ? result.reason : result.value.error;
      console.error(`Judge ${judgeLabel} failed:`, error);
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
  kbKnowledge?: string
): Promise<JudgeResult> {
  const startTime = Date.now();

  const prompt = getJudgeR1Prompt(judge.role, judge.label, article, kbKnowledge);

  const hasKB = !!kbKnowledge;
  const usesTools = judge.useWebSearch || judge.useXSearch;
  const maxTokens = usesTools ? 16384 : (hasKB ? 8192 : 6144);

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
  avg_scores['overall'] = Math.min(judgeOverall, weightedOverall);
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
