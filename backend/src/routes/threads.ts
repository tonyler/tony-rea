import { Router } from 'express';
import { callLLM } from '../services/llm';
import { saveThread, listThreads, getProject } from '../services/storage';
import { ThreadResultSchema } from '../schemas/output-schemas';
import { getThreadsPrompt } from '../prompts/threads';
import { createError } from '../middleware/error-handler';
import { llmLimiter } from '../middleware/rate-limit';

const router = Router();

// Apply stricter rate limiting to LLM endpoints
router.use(llmLimiter);

// POST /api/threads/generate - Generate thread
router.post('/generate', async (req, res, next) => {
  try {
    const { content, postCount = 8, constraints } = req.body;

    if (!content || typeof content !== 'string') {
      throw createError('content is required', 400);
    }

    if (typeof postCount !== 'number' || postCount < 1 || postCount > 50) {
      throw createError('postCount must be between 1 and 50', 400);
    }

    // Build user prompt
    let userPrompt = `Generate a thread from this content:\n\n${content}`;
    if (constraints) {
      userPrompt += `\n\nAdditional constraints: ${constraints}`;
    }

    // Call LLM to generate thread
    let result = await callLLM(
      {
        userPrompt,
        systemPrompt: getThreadsPrompt(postCount),
        maxRetries: 1,
      },
      ThreadResultSchema
    );

    // Check if any posts exceed 280 characters
    if (result.success) {
      const violations = result.data.posts
        .map((post, index) => ({ post, index, length: post.length }))
        .filter((p) => p.length > 280);

      if (violations.length > 0) {
        console.log(`Thread has ${violations.length} posts exceeding 280 chars. Retrying once...`);

        // Retry once with explicit instruction
        const retryPrompt = `${userPrompt}\n\nIMPORTANT: The previous attempt had posts exceeding 280 characters. Please regenerate with ALL posts strictly under 280 characters.`;

        result = await callLLM(
          {
            userPrompt: retryPrompt,
            systemPrompt: getThreadsPrompt(postCount),
            maxRetries: 0, // No more retries
          },
          ThreadResultSchema
        );

        // Check again
        if (result.success) {
          const newViolations = result.data.posts
            .map((post, index) => ({ post, index, length: post.length }))
            .filter((p) => p.length > 280);

          if (newViolations.length > 0) {
            // Still has violations after retry
            result.data.compliance = {
              all_under_280: false,
              violations: newViolations.map((v) => ({
                post_index: v.index,
                char_count: v.length,
              })),
            };
          } else {
            result.data.compliance = {
              all_under_280: true,
            };
          }
        }
      } else {
        result.data.compliance = {
          all_under_280: true,
        };
      }
    }

    if (!result.success) {
      throw createError(`Thread generation failed: ${result.error}`, 500);
    }

    res.json({ thread: result.data });
  } catch (error) {
    next(error);
  }
});

// POST /api/threads/save - Save generated thread
router.post('/save', async (req, res, next) => {
  try {
    const { projectId, title, posts, metadata } = req.body;

    if (!projectId || typeof projectId !== 'string') {
      throw createError('projectId is required', 400);
    }

    if (!title || typeof title !== 'string') {
      throw createError('title is required', 400);
    }

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      throw createError('posts array is required', 400);
    }

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    // Save thread
    const threadId = await saveThread(projectId, title, posts, metadata);

    res.status(201).json({
      threadId,
      saved: true,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/threads/:projectId - List saved threads
router.get('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    const threads = await listThreads(projectId);

    res.json({ threads });
  } catch (error) {
    next(error);
  }
});

export default router;
