import { Router } from 'express';
import { callLLM } from '../services/llm';
import { getProject, listEntries } from '../services/storage';
import { retrieveRelevantEntries, formatRetrievedKnowledge } from '../services/retrieval';
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

    // Load KB using RAG if project specified
    let knowledge = '';
    let retrievalInfo = null;

    if (projectId) {
      const project = await getProject(projectId);
      if (!project) {
        throw createError('Project not found', 404);
      }

      // RAG retrieval
      const retrieval = await retrieveRelevantEntries(projectId, userInput);

      if (retrieval.fallback || retrieval.entries.length === 0) {
        // Fallback: load all entries directly
        const allEntries = await listEntries(projectId);
        const activeEntries = allEntries.filter(e => !e.deprecated);
        knowledge = formatRetrievedKnowledge(activeEntries);
        const sources = activeEntries
          .flatMap((e) => e.data.sources || [])
          .filter((s): s is string => !!s);
        retrievalInfo = { fallback: true, entryCount: activeEntries.length, sources };
      } else {
        knowledge = formatRetrievedKnowledge(retrieval.entries);
        // Collect sources from retrieved entries
        const sources = retrieval.entries
          .flatMap((e) => e.data.sources || [])
          .filter((s): s is string => !!s);
        retrievalInfo = {
          fallback: false,
          entryCount: retrieval.entries.length,
          entryIds: retrieval.entryIds,
          reasoning: retrieval.reasoning,
          sources,
        };
      }
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
        mode: 'mod',
      },
      AssistantResponseSchema
    );

    if (!result.success) {
      throw createError(`LLM call failed: ${result.error}`, 500);
    }

    res.json({ result: result.data, retrieval: retrievalInfo });
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

    // Load KB using RAG if project specified
    let knowledge = '';
    let retrievalInfo = null;

    if (projectId) {
      const project = await getProject(projectId);
      if (!project) {
        throw createError('Project not found', 404);
      }

      // RAG retrieval
      const retrieval = await retrieveRelevantEntries(projectId, userInput);

      if (retrieval.fallback || retrieval.entries.length === 0) {
        // Fallback: load all entries directly
        const allEntries = await listEntries(projectId);
        const activeEntries = allEntries.filter(e => !e.deprecated);
        knowledge = formatRetrievedKnowledge(activeEntries);
        const sources = activeEntries
          .flatMap((e) => e.data.sources || [])
          .filter((s): s is string => !!s);
        retrievalInfo = { fallback: true, entryCount: activeEntries.length, sources };
      } else {
        knowledge = formatRetrievedKnowledge(retrieval.entries);
        // Collect sources from retrieved entries
        const sources = retrieval.entries
          .flatMap((e) => e.data.sources || [])
          .filter((s): s is string => !!s);
        retrievalInfo = {
          fallback: false,
          entryCount: retrieval.entries.length,
          entryIds: retrieval.entryIds,
          reasoning: retrieval.reasoning,
          sources,
        };
      }
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
        mode: 'education',
      },
      EducationResponseSchema
    );

    if (!result.success) {
      throw createError(`LLM call failed: ${result.error}`, 500);
    }

    res.json({ result: result.data, retrieval: retrievalInfo });
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

    // Call LLM — use gpt-4o via OpenAI direct for grammar correction
    const result = await callLLM(
      {
        userPrompt: text,
        systemPrompt: getGrammarPrompt(),
        model: 'gpt-5-mini',
        temperature: 1,
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
