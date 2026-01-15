import { Router } from 'express';
import { callLLM } from '../services/llm';
import {
  createEntry,
  listEntries,
  getEntry,
  deprecateEntry,
  hardDeleteEntry,
  readKB,
  getProject,
} from '../services/storage';
import { compileKB } from '../services/kb-compiler';
import {
  FeedIngestResultSchema,
  KBPatchPlanSchema,
} from '../schemas/output-schemas';
import { getFeedIngestPrompt } from '../prompts/feed-ingest';
import { getFeedUpdatePrompt } from '../prompts/feed-update';
import { createError } from '../middleware/error-handler';
import { llmLimiter } from '../middleware/rate-limit';

const router = Router();

// Apply stricter rate limiting to LLM endpoints
router.use(llmLimiter);

// POST /api/feed/ingest - Ingest new knowledge
router.post('/ingest', async (req, res, next) => {
  try {
    const { content, sources, projectId } = req.body;

    if (!content || typeof content !== 'string') {
      throw createError('content is required', 400);
    }

    if (!projectId || typeof projectId !== 'string') {
      throw createError('projectId is required', 400);
    }

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    // Build user prompt
    let userPrompt = `Content to extract:\n\n${content}`;
    if (sources && Array.isArray(sources) && sources.length > 0) {
      userPrompt += `\n\nProvided sources:\n${sources.join('\n')}`;
    }

    // Call LLM to extract facts
    const result = await callLLM(
      {
        userPrompt,
        systemPrompt: getFeedIngestPrompt(),
        maxRetries: 1,
      },
      FeedIngestResultSchema
    );

    if (!result.success) {
      throw createError(`LLM extraction failed: ${result.error}`, 500);
    }

    // Store entry
    const entry = await createEntry(projectId, result.data);

    // Recompile KB
    await compileKB(projectId);

    res.status(201).json({
      entry,
      extracted: result.data,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/feed/update - Update/supersede entries
router.post('/update', async (req, res, next) => {
  try {
    const { instruction, projectId, targetEntryIds } = req.body;

    if (!instruction || typeof instruction !== 'string') {
      throw createError('instruction is required', 400);
    }

    if (!projectId || typeof projectId !== 'string') {
      throw createError('projectId is required', 400);
    }

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    // Get current entries
    const entries = await listEntries(projectId);
    const currentEntriesText = entries
      .map((e) => `ID: ${e.id}\nTitle: ${e.data.title}\nFacts: ${e.data.extracted_facts.join(', ')}`)
      .join('\n\n');

    // Build user prompt
    let userPrompt = `Instruction: ${instruction}`;
    if (targetEntryIds && Array.isArray(targetEntryIds)) {
      userPrompt += `\n\nTarget Entry IDs: ${targetEntryIds.join(', ')}`;
    }

    // Call LLM to generate patch plan
    const result = await callLLM(
      {
        userPrompt,
        systemPrompt: getFeedUpdatePrompt(currentEntriesText),
        maxRetries: 1,
      },
      KBPatchPlanSchema
    );

    if (!result.success) {
      throw createError(`LLM patch plan failed: ${result.error}`, 500);
    }

    const plan = result.data;

    // Execute patch plan
    for (const entryId of plan.target_entry_ids) {
      if (plan.action === 'hard_delete') {
        await hardDeleteEntry(projectId, entryId);
      } else if (plan.action === 'deprecate' || plan.action === 'supersede') {
        await deprecateEntry(projectId, entryId);
      }
    }

    // Create new entry if superseding
    let newEntry = null;
    if (plan.action === 'supersede' && plan.new_entry) {
      newEntry = await createEntry(projectId, plan.new_entry);
    }

    // Recompile KB
    await compileKB(projectId);

    res.json({
      plan,
      newEntry,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/feed/delete - Delete/deprecate entries
router.post('/delete', async (req, res, next) => {
  try {
    const { entryIds, projectId, hard } = req.body;

    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      throw createError('entryIds array is required', 400);
    }

    if (!projectId || typeof projectId !== 'string') {
      throw createError('projectId is required', 400);
    }

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    // Delete or deprecate entries
    for (const entryId of entryIds) {
      if (hard === true) {
        await hardDeleteEntry(projectId, entryId);
      } else {
        await deprecateEntry(projectId, entryId);
      }
    }

    // Recompile KB
    await compileKB(projectId);

    res.json({
      deleted: entryIds,
      action: hard ? 'hard_delete' : 'deprecate',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/feed/entries/:projectId - List entries
router.get('/entries/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    const entries = await listEntries(projectId);

    res.json({ entries });
  } catch (error) {
    next(error);
  }
});

// GET /api/feed/kb/:projectId - Get compiled KB
router.get('/kb/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    const kb = await readKB(projectId);

    res.json({ kb });
  } catch (error) {
    next(error);
  }
});

export default router;
