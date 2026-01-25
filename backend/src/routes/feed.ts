import { Router } from 'express';
import { callLLM } from '../services/llm';
import {
  createEntry,
  listEntries,
  getEntry,
  deprecateEntry,
  hardDeleteEntry,
  getProject,
} from '../services/storage';
import { compileKB } from '../services/kb-compiler';
import {
  FeedIngestResponseSchema,
  KBPatchPlanSchema,
} from '../schemas/output-schemas';
import { getFeedIngestPrompt } from '../prompts/feed-ingest';
import { getFeedUpdatePrompt } from '../prompts/feed-update';
import { createError } from '../middleware/error-handler';
import { llmLimiter } from '../middleware/rate-limit';
import { getMCPClient } from '../services/mcp-client';
import { PREDEFINED_TAGS, normalizeToPrefinedTag, addPendingTag } from '../config/tags';

const router = Router();

// Apply stricter rate limiting to LLM endpoints
router.use(llmLimiter);

/**
 * Normalize and validate tags against predefined list.
 * Rules:
 * - Only allow tags from PREDEFINED_TAGS list
 * - AMA + Spaces: Always include both if either is present
 * - Twitter: Add for Twitter/X platform content (Spaces, tweets, contests, engagement, etc.)
 * Returns: { tags: validated tags, invalidTags: tags not in predefined list }
 */
function normalizeTags(
  tags: string[] | null | undefined,
  suggestedNewTags?: string[] | null
): { tags: string[]; invalidTags: string[] } {
  if (!tags || tags.length === 0) return { tags: [], invalidTags: [] };

  const validatedTags: string[] = [];
  const invalidTags: string[] = [];

  // Validate each tag against predefined list
  for (const tag of tags) {
    const normalized = normalizeToPrefinedTag(tag);
    if (normalized) {
      validatedTags.push(normalized);
    } else {
      invalidTags.push(tag);
    }
  }

  // Add suggested new tags to invalid list for tracking
  if (suggestedNewTags && suggestedNewTags.length > 0) {
    for (const tag of suggestedNewTags) {
      if (!invalidTags.includes(tag)) {
        invalidTags.push(tag);
      }
    }
  }

  const lowerTags = validatedTags.map(t => t.toLowerCase());

  // AMA <-> Spaces pairing
  const hasAMA = lowerTags.includes('ama');
  const hasSpaces = lowerTags.includes('spaces');

  if (hasAMA && !hasSpaces) {
    validatedTags.push('Spaces');
  } else if (hasSpaces && !hasAMA) {
    validatedTags.push('AMA');
  }

  // Twitter tag - add for any Twitter/X platform related content
  const hasTwitter = lowerTags.includes('twitter');
  if (hasSpaces && !hasTwitter) {
    validatedTags.push('Twitter');
  }

  // Deduplicate (case-insensitive)
  const seen = new Set<string>();
  const deduped = validatedTags.filter(tag => {
    const lower = tag.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  return { tags: deduped, invalidTags };
}

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
    let userPrompt = `Content to process:\n\n${content}`;
    if (sources && Array.isArray(sources) && sources.length > 0) {
      userPrompt += `\n\nProvided sources:\n${sources.join('\n')}`;
    }

    // Call LLM to create entries (may split into multiple if multi-topic)
    // maxTokens set high to handle large file ingestion
    const result = await callLLM(
      {
        userPrompt,
        systemPrompt: getFeedIngestPrompt(),
        maxRetries: 1,
        maxTokens: 16384,
      },
      FeedIngestResponseSchema
    );

    if (!result.success) {
      throw createError(`LLM processing failed: ${result.error}`, 500);
    }

    // Store all entries (handles topic splitting)
    const createdEntries = [];
    const allSuggestedTags: string[] = [];

    for (const entryData of result.data.entries) {
      // Ensure sources are set if provided
      if (sources && Array.isArray(sources) && sources.length > 0 && (!entryData.sources || entryData.sources.length === 0)) {
        entryData.sources = sources;
      }
      // Normalize and validate tags against predefined list
      const { tags, invalidTags } = normalizeTags(entryData.tags, entryData.suggested_new_tags);
      entryData.tags = tags;

      // Track suggested new tags for review and add to pending
      if (invalidTags.length > 0) {
        for (const tag of invalidTags) {
          if (!allSuggestedTags.includes(tag)) {
            allSuggestedTags.push(tag);
            addPendingTag(tag, 'llm'); // Add to pending for user review
          }
        }
        console.log(`[Feed Ingest] Suggested new tags added to pending: ${invalidTags.join(', ')}`);
      }

      // Remove suggested_new_tags before storing (already tracked)
      delete entryData.suggested_new_tags;

      const entry = await createEntry(projectId, entryData);
      createdEntries.push(entry);
    }

    // Recompile KB index
    await compileKB(projectId);

    res.status(201).json({
      entries: createdEntries,
      count: createdEntries.length,
      suggestedNewTags: allSuggestedTags.length > 0 ? allSuggestedTags : undefined,
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
      .map((e) => `ID: ${e.id}\nTitle: ${e.data.title}\nContent: ${e.data.full_content.substring(0, 200)}...`)
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

// GET /api/feed/kb/:projectId - Get KB index (list of entries)
router.get('/kb/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    // Return kb-index.md (simple id: title list) instead of full kb.md
    const { readKBIndex } = await import('../services/storage');
    const kb = await readKBIndex(projectId);

    res.json({ kb: kb || 'No entries yet.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/feed/mcp/explore - Connect to MCP server and list available resources/tools
router.post('/mcp/explore', async (req, res, next) => {
  try {
    const { mcpUrl } = req.body;

    if (!mcpUrl || typeof mcpUrl !== 'string') {
      throw createError('mcpUrl is required', 400);
    }

    const client = getMCPClient();
    await client.connect(mcpUrl);

    try {
      const capabilities = client.getServerCapabilities();
      console.log('Server capabilities:', capabilities);

      let resources: any[] = [];
      let tools: any[] = [];

      // Try to list resources if supported
      if (capabilities.resources) {
        try {
          resources = await client.listResources();
        } catch (e) {
          console.warn('Failed to list resources:', e);
        }
      }

      // Try to list tools if supported
      if (capabilities.tools) {
        try {
          tools = await client.listTools();
        } catch (e) {
          console.warn('Failed to list tools:', e);
        }
      }

      res.json({ resources, tools, capabilities, serverUrl: mcpUrl });
    } finally {
      await client.disconnect();
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/feed/mcp/ingest - Fetch content from MCP server and ingest
router.post('/mcp/ingest', async (req, res, next) => {
  try {
    const { mcpUrl, projectId, resourceUris } = req.body;

    if (!mcpUrl || typeof mcpUrl !== 'string') {
      throw createError('mcpUrl is required', 400);
    }

    if (!projectId || typeof projectId !== 'string') {
      throw createError('projectId is required', 400);
    }

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    const client = getMCPClient();
    await client.connect(mcpUrl);

    const results: Array<{ uri: string; success: boolean; entry?: any; error?: string }> = [];

    try {
      // Get resources to process
      let resources = await client.listResources();

      // Filter to specific URIs if provided
      if (resourceUris && Array.isArray(resourceUris) && resourceUris.length > 0) {
        resources = resources.filter(r => resourceUris.includes(r.uri));
      }

      // Process each resource
      for (const resource of resources) {
        try {
          const contents = await client.readResource(resource.uri);
          const textContent = contents.find(c => c.text)?.text;

          if (!textContent) {
            results.push({ uri: resource.uri, success: false, error: 'No text content' });
            continue;
          }

          // Build prompt for LLM
          const userPrompt = `Content to process:\n\n${textContent}\n\nProvided sources:\n${resource.uri}`;

          // Call LLM to create entries (may split into multiple if multi-topic)
          // maxTokens set high to handle large file ingestion
          const llmResult = await callLLM(
            {
              userPrompt,
              systemPrompt: getFeedIngestPrompt(),
              maxRetries: 1,
              maxTokens: 16384,
            },
            FeedIngestResponseSchema
          );

          if (!llmResult.success) {
            results.push({ uri: resource.uri, success: false, error: llmResult.error });
            continue;
          }

          // Store all entries (handles topic splitting)
          for (const entryData of llmResult.data.entries) {
            if (!entryData.sources || entryData.sources.length === 0) {
              entryData.sources = [resource.uri];
            }
            // Normalize and validate tags against predefined list
            const { tags, invalidTags } = normalizeTags(entryData.tags, entryData.suggested_new_tags);
            entryData.tags = tags;
            if (invalidTags.length > 0) {
              for (const tag of invalidTags) {
                addPendingTag(tag, 'llm'); // Add to pending for user review
              }
              console.log(`[MCP Ingest] Suggested new tags added to pending: ${invalidTags.join(', ')}`);
            }
            delete entryData.suggested_new_tags;
            const entry = await createEntry(projectId, entryData);
            results.push({ uri: resource.uri, success: true, entry });
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ uri: resource.uri, success: false, error: errorMessage });
        }
      }

      // Recompile KB after all entries are added
      await compileKB(projectId);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      res.json({
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount,
        },
        results,
      });

    } finally {
      await client.disconnect();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
