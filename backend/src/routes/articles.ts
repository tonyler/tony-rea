import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getExampleArticles } from '../services/voice-analyzer';
import { Article } from '../services/x-scraper';
import { runCouncil, buildJudgeConfigs, getDefaultJudges } from '../services/council';
import type { SearchMode } from '../services/council';
import {
  callMultiLLM,
  initializeProviders,
  createBudgetTracker,
  recordCall,
  canAffordCall,
  BudgetTracker,
  ModelId,
  getAvailableModels,
} from '../services/multi-llm';
import { getClaudeV1Prompt, getClaudeFinalPrompt, getQuickRevisionPrompt, ArticleRequest, FlaggedPhraseWithJudge } from '../prompts/articles';
import { saveArticle, loadArticle, listArticles, initializeArticleStorage } from '../services/storage';
import { ArticleResult, ArticleResultSchema } from '../schemas/article-result';
import { retrieveRelevantEntries, formatRetrievedKnowledge } from '../services/retrieval';

const router = Router();

// Initialize LLM providers and article storage on module load
initializeProviders();
initializeArticleStorage();

// New flexible request schema
const ArticleRequestSchema = z.object({
  type: z.enum(['topic', 'points', 'draft', 'full']),
  topic: z.string().optional(),
  points: z.array(z.string()).optional(),
  draft: z.string().optional(),
  styleNotes: z.string().optional(),
});

const ModelIdEnum = z.enum([
  'claude-sonnet-4-5',
  'sonar',
  'gpt-5.2',
  'gpt-5-mini',
  'gemini-3-pro',
  'gemini-2.5-flash',
  'grok-4-1-fast',
  'grok-4-1-fast-x',
]);
const JudgeRoleEnum = z.enum(['fact-checker', 'slop-detector', 'originality-reviewer', 'rules-enforcer']);
const SearchModeEnum = z.enum(['full', 'none', 'web-only', 'x-only']);
const CouncilModeEnum = z.enum(['skip', 'standard']);

const GenerateRequestSchema = z.object({
  voiceHandle: z.string().min(1),
  // Legacy support
  content: z.string().optional(),
  // New format
  request: ArticleRequestSchema.optional(),
  wordCount: z.number().min(100).max(5000).default(1200),
  constraints: z.string().optional(),
  // Optional project KB for fact verification
  projectId: z.string().optional(),
  // LLM configuration
  searchMode: SearchModeEnum.default('full'),
  draftModel: ModelIdEnum.default('claude-sonnet-4-5'),
  revisionModel: ModelIdEnum.default('claude-sonnet-4-5'),
  judges: z.array(z.object({
    model: ModelIdEnum,
    role: JudgeRoleEnum,
  })).min(0).max(4).optional(),
  councilMode: CouncilModeEnum.default('standard'),
}).refine(
  (data) => data.content || data.request,
  { message: 'Either content or request must be provided' }
);

const ReviseRequestSchema = z.object({
  instruction: z.string().min(1),
  preserveDebate: z.boolean().default(false),
});

const SaveRequestSchema = ArticleResultSchema;

router.get('/models', (_req: Request, res: Response) => {
  res.json({ models: getAvailableModels() });
});

router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('[articles] POST /generate received');
    const parsed = GenerateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('[articles] Invalid request:', parsed.error.issues);
      res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
      return;
    }

    const {
      voiceHandle, content, request, wordCount, constraints, projectId,
      searchMode, draftModel, revisionModel, judges: judgesInput, councilMode,
    } = parsed.data;
    console.log(`[articles] Generating for voice=${voiceHandle}, wordCount=${wordCount}, draft=${draftModel}, council=${councilMode}${projectId ? `, project=${projectId}` : ''}`);

    // Build ArticleRequest from input
    let articleRequest: ArticleRequest | undefined;
    if (request) {
      articleRequest = request as ArticleRequest;
    } else if (content) {
      // Legacy format: treat content as topic
      articleRequest = { type: 'topic', topic: content };
    }

    // Step 1: Get example articles for voice
    console.log('[articles] Step 1: Fetching example articles...');
    let exampleArticles: Article[];
    try {
      exampleArticles = await getExampleArticles(voiceHandle);
      console.log(`[articles] Got ${exampleArticles.length} example articles`);
    } catch (error) {
      console.error('[articles] Failed to get examples:', error);
      res.status(400).json({
        error: 'Example articles not available',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }

    // Step 1.5: Retrieve relevant KB entries if projectId is provided
    const topicText = content || articleRequest?.topic || '';
    let kbKnowledge = '';

    if (projectId) {
      console.log(`[articles] Step 1.5: Retrieving KB entries for project=${projectId}...`);
      const retrieval = await retrieveRelevantEntries(projectId, topicText);

      if (retrieval.entries.length > 0) {
        kbKnowledge = formatRetrievedKnowledge(retrieval.entries);
        console.log(`[articles] Found ${retrieval.entries.length} relevant KB entries`);
      } else if (retrieval.fallback) {
        console.log(`[articles] No KB entries found (${retrieval.reasoning})`);
      }
    }

    // Step 2: Generate initial article with selected draft model
    console.log(`[articles] Step 2: Calling ${draftModel}...`);
    let budget = createBudgetTracker();
    const warnings: string[] = [];

    // Inject KB knowledge into chunks if available
    const chunks = kbKnowledge ? [kbKnowledge] : [];

    const claudeV1Prompt = getClaudeV1Prompt(
      topicText,
      wordCount,
      exampleArticles,
      chunks,
      constraints,
      articleRequest
    );

    const ArticleContentSchema = z.object({
      title: z.string(),
      content: z.string(),
    });

    const draftResult = await callMultiLLM(draftModel, {
      systemPrompt: claudeV1Prompt.system,
      userPrompt: claudeV1Prompt.user,
      temperature: 0.7,
      maxTokens: 8192,
    }, ArticleContentSchema);

    let v1Result = draftResult;

    if (!v1Result.success || !v1Result.data) {
      const isJsonParseError = v1Result.error?.includes('JSON parse error');
      if (isJsonParseError) {
        console.warn(`[articles] ${draftModel} JSON parse failed. Retrying with GPT-5-mini...`);
        const strictJsonSystem = `${claudeV1Prompt.system}\n\nReturn ONLY valid JSON. Do not include tool calls, browsing steps, or <search> tags.`;
        const gptRetry = await callMultiLLM('gpt-5-mini', {
          systemPrompt: strictJsonSystem,
          userPrompt: claudeV1Prompt.user,
          temperature: 1,
          maxTokens: 8192,
        }, ArticleContentSchema);
        v1Result = gptRetry;
        if (v1Result.success) {
          budget = recordCall(budget, 'gpt-5-mini', v1Result.tokens, v1Result.cost);
        }
      }
    }

    if (!v1Result.success || !v1Result.data) {
      console.error(`[articles] ${draftModel} draft failed:`, v1Result.error);
      res.status(500).json({ error: 'Article generation failed', details: v1Result.error });
      return;
    }

    if (draftResult.success) {
      console.log(`[articles] Draft complete (${draftModel}), cost: $` + draftResult.cost.toFixed(4));
      budget = recordCall(budget, draftModel, draftResult.tokens, draftResult.cost);
    }

    const initialArticle = v1Result.data;

    // Step 3: Run council evaluation (quality/ethics only - no voice examples)
    let councilResult: Awaited<ReturnType<typeof runCouncil>> | null = null;
    let flaggedPhrases: FlaggedPhraseWithJudge[] = [];

    if (councilMode === 'skip') {
      console.log('[articles] Step 3: Council skipped (councilMode=skip)');
    } else {
      console.log('[articles] Step 3: Running council evaluation...');

      // Build judge configs from request or use defaults
      let judgeConfigs;
      if (judgesInput && judgesInput.length > 0) {
        const built = buildJudgeConfigs(judgesInput, searchMode);
        judgeConfigs = built.configs;
        warnings.push(...built.warnings);
      } else {
        judgeConfigs = getDefaultJudges(searchMode as SearchMode);
      }

      councilResult = await runCouncil(initialArticle.content, budget, {
        kbKnowledge,
        judges: judgeConfigs,
        searchMode: searchMode as SearchMode,
      });
      budget = councilResult.budget;
      warnings.push(...councilResult.warnings);
      flaggedPhrases = councilResult.allFlaggedPhrases || [];
    }

    // Step 4: Auto-revise if council found issues (not early stop or skip final)
    let finalArticle = initialArticle;
    const estimatedRevisionCost = 0.04;

    const skipRevision = !councilResult || councilResult.skipFinalRevision;

    if (!skipRevision && canAffordCall(budget, estimatedRevisionCost)) {
      const roundToUse = councilResult!.r2 || councilResult!.r1;

      const finalPrompt = getClaudeFinalPrompt(
        initialArticle.content,
        roundToUse,
        exampleArticles,
        flaggedPhrases
      );

      console.log(`[articles] Step 4: Running final revision with ${revisionModel} (budget remaining: $${budget.remaining.toFixed(4)})`);
      const finalResult = await callMultiLLM(revisionModel, {
        systemPrompt: finalPrompt.system,
        userPrompt: finalPrompt.user,
        temperature: 0.5,
        maxTokens: 8192,
      }, ArticleContentSchema);

      if (finalResult.success && finalResult.data) {
        budget = recordCall(budget, revisionModel, finalResult.tokens, finalResult.cost);
        finalArticle = finalResult.data;
      }
    } else if (skipRevision) {
      console.log('[articles] Step 4: Skipping final revision (council approved or skipped)');
    } else {
      console.log(`[articles] Step 4: Skipping final revision (budget remaining: $${budget.remaining.toFixed(4)})`);
    }

    // Build response
    const articleId = `article-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const contentChanged = finalArticle.content !== initialArticle.content || finalArticle.title !== initialArticle.title;

    // Build empty debate round for council-skipped case
    const emptyRound = {
      round: 1 as const,
      opinions: {} as Record<string, any>,
      avg_scores: {} as Record<string, number>,
      consensus_fixes: [] as string[],
      priority_fixes: [] as Array<{ fix: string; priority: number; votes: number }>,
    };

    const result: ArticleResult = {
      id: articleId,
      title: finalArticle.title,
      content: finalArticle.content,
      wordCount: finalArticle.content.split(/\s+/).length,
      debate: {
        r1: councilResult ? councilResult.r1 : emptyRound,
        r2: councilResult ? councilResult.r2 : null,
      },
      budget: {
        calls: budget.calls,
        total: budget.total,
        remaining: budget.remaining,
        maxBudget: budget.maxBudget,
      },
      exampleArticles,
      ...(contentChanged ? { initialDraft: { title: initialArticle.title, content: initialArticle.content } } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
      createdAt: new Date().toISOString(),
    };

    // Auto-save so revisions work immediately
    await saveArticle(result);

    console.log(`[articles] Done! id=${articleId}, words=${result.wordCount}, cost=$${budget.total.toFixed(4)}`);
    res.json(result);
  } catch (error) {
    console.error('[articles] Unhandled error:', error);
    next(error);
  }
});

router.post('/:articleId/revise', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { articleId } = req.params;
    const parsed = ReviseRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
      return;
    }

    const { instruction, preserveDebate } = parsed.data;

    const existingArticle = await loadArticle(articleId);
    if (!existingArticle) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    let budget = createBudgetTracker();
    const exampleArticles = (existingArticle.exampleArticles || []) as Article[];

    if (preserveDebate) {
      // Quick edit: just revise with Claude
      const quickPrompt = getQuickRevisionPrompt(
        existingArticle.content,
        instruction,
        existingArticle.debate.r2
      );

      const ArticleContentSchema = z.object({
        title: z.string(),
        content: z.string(),
      });

      const result = await callMultiLLM('claude-sonnet-4-5', {
        systemPrompt: quickPrompt.system,
        userPrompt: quickPrompt.user,
        temperature: 0.5,
        maxTokens: 8192,
      }, ArticleContentSchema);

      if (!result.success || !result.data) {
        res.status(500).json({ error: 'Revision failed', details: result.error });
        return;
      }

      budget = recordCall(budget, 'claude-sonnet-4-5', result.tokens, result.cost);

      const quickContentChanged = result.data.content !== existingArticle.content || result.data.title !== existingArticle.title;

      const revised: ArticleResult = {
        ...existingArticle,
        id: `article-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: result.data.title,
        content: result.data.content,
        wordCount: result.data.content.split(/\s+/).length,
        budget: {
          calls: budget.calls,
          total: budget.total,
          remaining: budget.remaining,
          maxBudget: budget.maxBudget,
        },
        ...(quickContentChanged ? { initialDraft: { title: existingArticle.title, content: existingArticle.content } } : {}),
        createdAt: new Date().toISOString(),
      };

      await saveArticle(revised);
      res.json(revised);
    } else {
      // Full re-council
      const claudePrompt = getClaudeV1Prompt(
        `${instruction}\n\nOriginal article:\n${existingArticle.content}`,
        existingArticle.wordCount,
        exampleArticles,
        []
      );

      const ArticleContentSchema = z.object({
        title: z.string(),
        content: z.string(),
      });

      const claudeResult = await callMultiLLM('claude-sonnet-4-5', {
        systemPrompt: claudePrompt.system,
        userPrompt: claudePrompt.user,
        temperature: 0.7,
        maxTokens: 8192,
      }, ArticleContentSchema);

      if (!claudeResult.success || !claudeResult.data) {
        res.status(500).json({ error: 'Revision failed', details: claudeResult.error });
        return;
      }

      budget = recordCall(budget, 'claude-sonnet-4-5', claudeResult.tokens, claudeResult.cost);

      const councilResult = await runCouncil(claudeResult.data.content, budget);
      budget = councilResult.budget;

      let finalArticle = claudeResult.data;

      if (councilResult.r2 && !councilResult.earlyStop) {
        const finalPrompt = getClaudeFinalPrompt(claudeResult.data.content, councilResult.r2, exampleArticles);

        const finalResult = await callMultiLLM('claude-sonnet-4-5', {
          systemPrompt: finalPrompt.system,
          userPrompt: finalPrompt.user,
          temperature: 0.5,
          maxTokens: 8192,
        }, ArticleContentSchema);

        if (finalResult.success && finalResult.data) {
          budget = recordCall(budget, 'claude-sonnet-4-5', finalResult.tokens, finalResult.cost);
          finalArticle = finalResult.data;
        }
      }

      const recouncilContentChanged = finalArticle.content !== claudeResult.data.content || finalArticle.title !== claudeResult.data.title;

      const result: ArticleResult = {
        id: `article-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: finalArticle.title,
        content: finalArticle.content,
        wordCount: finalArticle.content.split(/\s+/).length,
        debate: {
          r1: councilResult.r1,
          r2: councilResult.r2,
        },
        budget: {
          calls: budget.calls,
          total: budget.total,
          remaining: budget.remaining,
          maxBudget: budget.maxBudget,
        },
        exampleArticles,
        ...(recouncilContentChanged ? { initialDraft: { title: claudeResult.data.title, content: claudeResult.data.content } } : {}),
        createdAt: new Date().toISOString(),
      };

      await saveArticle(result);
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
});

router.post('/save', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = SaveRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid article data', details: parsed.error.issues });
      return;
    }

    await saveArticle(parsed.data);

    res.json({ saved: true, id: parsed.data.id });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const articles = await listArticles();

    res.json({ articles });
  } catch (error) {
    next(error);
  }
});

router.get('/:articleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { articleId } = req.params;
    const article = await loadArticle(articleId);

    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    res.json(article);
  } catch (error) {
    next(error);
  }
});

export default router;
