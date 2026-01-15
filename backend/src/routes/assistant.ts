import { Router } from 'express';
import { callLLM } from '../services/llm';
import { readKB, getProject } from '../services/storage';
import {
  AssistantResponseSchema,
  EducationResponseSchema,
  GrammarResponseSchema,
} from '../schemas/output-schemas';
import { getModPrompt } from '../prompts/mod';
import { getEducationPrompt } from '../prompts/education';
import { getGrammarPrompt } from '../prompts/grammar';
import { createError } from '../middleware/error-handler';
import { llmLimiter } from '../middleware/rate-limit';

const router = Router();

// Apply stricter rate limiting to LLM endpoints
router.use(llmLimiter);

// POST /api/assistant/mod - Mod reply generation
router.post('/mod', async (req, res, next) => {
  try {
    const { userInput, context, projectId } = req.body;

    if (!userInput || typeof userInput !== 'string') {
      throw createError('userInput is required', 400);
    }

    // Load KB if project specified
    let knowledge = '';
    if (projectId) {
      const project = await getProject(projectId);
      if (!project) {
        throw createError('Project not found', 404);
      }
      knowledge = await readKB(projectId);
    }

    // Build user prompt
    let userPrompt = `User Question: ${userInput}`;
    if (context) {
      userPrompt += `\n\nAdditional Context: ${context}`;
    }

    // Call LLM
    const result = await callLLM(
      {
        userPrompt,
        systemPrompt: getModPrompt(knowledge),
        maxRetries: 1,
      },
      AssistantResponseSchema
    );

    if (!result.success) {
      throw createError(`LLM call failed: ${result.error}`, 500);
    }

    res.json({ result: result.data });
  } catch (error) {
    next(error);
  }
});

// POST /api/assistant/education - Education mode
router.post('/education', async (req, res, next) => {
  try {
    const { userInput, context, projectId } = req.body;

    if (!userInput || typeof userInput !== 'string') {
      throw createError('userInput is required', 400);
    }

    // Load KB if project specified
    let knowledge = '';
    if (projectId) {
      const project = await getProject(projectId);
      if (!project) {
        throw createError('Project not found', 404);
      }
      knowledge = await readKB(projectId);
    }

    // Build user prompt
    let userPrompt = `Topic to teach: ${userInput}`;
    if (context) {
      userPrompt += `\n\nAdditional Context: ${context}`;
    }

    // Call LLM
    const result = await callLLM(
      {
        userPrompt,
        systemPrompt: getEducationPrompt(knowledge),
        maxRetries: 1,
      },
      EducationResponseSchema
    );

    if (!result.success) {
      throw createError(`LLM call failed: ${result.error}`, 500);
    }

    res.json({ result: result.data });
  } catch (error) {
    next(error);
  }
});

// POST /api/assistant/grammar - Grammar correction
router.post('/grammar', async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      throw createError('text is required', 400);
    }

    // Call LLM
    const result = await callLLM(
      {
        userPrompt: text,
        systemPrompt: getGrammarPrompt(),
        maxRetries: 1,
      },
      GrammarResponseSchema
    );

    if (!result.success) {
      throw createError(`LLM call failed: ${result.error}`, 500);
    }

    res.json({ result: result.data });
  } catch (error) {
    next(error);
  }
});

export default router;
