import { Router } from 'express';
import { callLLM } from '../services/llm';
import {
  Entry,
  createEntry,
  listEntries,
  getEntry,
  updateEntry,
  deprecateEntry,
  hardDeleteEntry,
  getProject,
} from '../services/storage';
import { compileKB } from '../services/kb-compiler';
import {
  FeedIngestResult,
  FeedIngestResponseSchema,
  KBPatchPlanSchema,
  MergeEvaluationSchema,
} from '../schemas/output-schemas';
import { getFeedIngestPrompt } from '../prompts/feed-ingest';
import { getFeedUpdatePrompt } from '../prompts/feed-update';
import { createError } from '../middleware/error-handler';
import { llmLimiter } from '../middleware/rate-limit';
import { getMCPClient } from '../services/mcp-client';
import { PREDEFINED_TAGS, normalizeToPrefinedTag, addPendingTag, buildTagNormalizationPrompt } from '../config/tags';
import { TagNormalizationSchema } from '../schemas/output-schemas';
import { retrieveRelevantEntries } from '../services/retrieval';
import { getMergeEvaluationPrompt, buildMergeEvaluationUserPrompt } from '../prompts/merge-evaluation';

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

interface IngestAction {
  action: 'created' | 'merged' | 'superseded';
  entryId: string;
  reasoning?: string;
  mergedIntoTitle?: string;
  deprecatedEntryIds?: string[];
}

const LEGACY_ENTRY_ID_PATTERN = /^entry-/i;
const GENERIC_TITLE_PATTERNS = [
  /^entry(?:\s+|[-_])?\d*$/i,
  /^untitled$/i,
  /^new entry$/i,
  /^title$/i,
  /^announcement$/i,
  /^update$/i,
  /^info$/i,
];
const TITLE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with', 'without',
]);
const TEXT_SIMILARITY_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'in', 'is', 'it', 'of', 'on', 'or',
  'that', 'the', 'this', 'to', 'was', 'were', 'with',
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[`*_>#~-]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ');
}

function titleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

function tokenizeForSimilarity(value: string): Set<string> {
  const tokens = (normalizeWhitespace(stripMarkdown(value)).toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [])
    .filter((token) => token.length > 2 && !TEXT_SIMILARITY_STOP_WORDS.has(token));
  return new Set(tokens);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function normalizeSource(source: string): string {
  return source.trim().toLowerCase().replace(/\/+$/, '');
}

function hasSourceOverlap(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const first = new Set((a ?? []).map(normalizeSource).filter(Boolean));
  if (first.size === 0) return false;
  for (const source of b ?? []) {
    if (first.has(normalizeSource(source))) return true;
  }
  return false;
}

function sharedTagCount(a: string[] | null | undefined, b: string[] | null | undefined): number {
  const first = new Set((a ?? []).map((tag) => tag.toLowerCase()));
  let count = 0;
  for (const tag of b ?? []) {
    if (first.has(tag.toLowerCase())) count++;
  }
  return count;
}

function shouldConsolidateDuplicate(canonicalEntry: Entry, candidate: Entry): boolean {
  // Never auto-consolidate entries created in the same ingest run
  if (
    canonicalEntry.data.ingest_group_id &&
    candidate.data.ingest_group_id &&
    canonicalEntry.data.ingest_group_id === candidate.data.ingest_group_id
  ) {
    return false;
  }

  if (titleKey(canonicalEntry.data.title) !== titleKey(candidate.data.title)) {
    return false;
  }

  // Strong signal: same source URL(s)
  if (hasSourceOverlap(canonicalEntry.data.sources, candidate.data.sources)) {
    return true;
  }

  // Strong signal: same day and meaningful tag overlap
  if (
    canonicalEntry.data.date_detected &&
    candidate.data.date_detected &&
    canonicalEntry.data.date_detected === candidate.data.date_detected &&
    sharedTagCount(canonicalEntry.data.tags, candidate.data.tags) >= 2
  ) {
    return true;
  }

  // Content-level signal: high token overlap
  const similarity = jaccardSimilarity(
    tokenizeForSimilarity(canonicalEntry.data.full_content ?? ''),
    tokenizeForSimilarity(candidate.data.full_content ?? '')
  );
  return similarity >= 0.72;
}

function generateIngestGroupId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 3 && word === word.toUpperCase()) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function isWeakTitle(title: string): boolean {
  const cleaned = normalizeWhitespace(stripMarkdown(title));
  if (!cleaned) return true;
  if (GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(cleaned))) return true;
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length < 3;
}

function buildTitleFromContent(content: string): string {
  const clean = normalizeWhitespace(stripMarkdown(content));
  const tokens = clean.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) ?? [];
  const filtered = tokens.filter((token) => !TITLE_STOP_WORDS.has(token.toLowerCase()));
  const source = filtered.length >= 4 ? filtered : tokens;
  const picked = source.slice(0, 6);
  if (picked.length === 0) {
    return 'Knowledge Update';
  }
  return toTitleCase(picked.join(' '));
}

function canonicalizeTitle(rawTitle: string | null | undefined, content: string): string {
  const inputTitle = normalizeWhitespace(stripMarkdown(rawTitle ?? ''));
  const title = isWeakTitle(inputTitle) ? buildTitleFromContent(content) : inputTitle;
  const clipped = title.substring(0, 90).trim();
  return clipped || 'Knowledge Update';
}

async function consolidateEntriesByTitle(
  projectId: string,
  canonicalEntry: Entry
): Promise<string[]> {
  const allEntries = await listEntries(projectId);
  const activeEntries = allEntries.filter((entry) => !entry.deprecated && entry.id !== canonicalEntry.id);
  const deprecatedEntryIds: string[] = [];

  for (const candidate of activeEntries) {
    if (!shouldConsolidateDuplicate(canonicalEntry, candidate)) continue;
    await deprecateEntry(projectId, candidate.id, canonicalEntry.id);
    deprecatedEntryIds.push(candidate.id);
  }

  return deprecatedEntryIds;
}

async function evaluateAndSave(
  projectId: string,
  entryData: FeedIngestResult
): Promise<{ entry: Entry; ingestAction: IngestAction }> {
  const normalizedEntry: FeedIngestResult = {
    ...entryData,
    title: canonicalizeTitle(entryData.title, entryData.full_content),
    tags: entryData.tags && entryData.tags.length > 0 ? entryData.tags : ['Announcement'],
  };

  // 1. Find related existing entries via RAG retrieval
  let existingEntries: Entry[] = [];
  try {
    const retrievalQuery = `${normalizedEntry.title} ${normalizedEntry.full_content.substring(0, 200)}`;
    const retrieval = await retrieveRelevantEntries(projectId, retrievalQuery);
    existingEntries = retrieval.entries.slice(0, 10);
    console.log(`[Merge Eval] "${normalizedEntry.title}" — retrieval found ${existingEntries.length} related entries`);
  } catch {
    console.log(`[Merge Eval] "${normalizedEntry.title}" — retrieval failed, creating new entry`);
    // Non-fatal: fall through to create
  }

  // 2. Skip merge LLM if no related entries found
  if (existingEntries.length === 0) {
    console.log(`[Merge Eval] "${normalizedEntry.title}" — no related entries, creating new`);
    const entry = await createEntry(projectId, normalizedEntry);
    const deprecatedEntryIds = await consolidateEntriesByTitle(projectId, entry);
    return { entry, ingestAction: { action: 'created', entryId: entry.id, deprecatedEntryIds } };
  }

  // 3. Call gpt-5 to decide create vs merge
  const candidateForPrompt = {
    title: normalizedEntry.title,
    full_content: normalizedEntry.full_content,
    date_detected: normalizedEntry.date_detected,
    tags: normalizedEntry.tags ?? [],
  };
  const existingForPrompt = existingEntries.map(e => ({
    id: e.id,
    title: e.data.title,
    full_content: e.data.full_content,
    date_detected: e.data.date_detected,
    tags: e.data.tags ?? [],
  }));

  const mergeResult = await callLLM(
    {
      userPrompt: buildMergeEvaluationUserPrompt(candidateForPrompt, existingForPrompt),
      systemPrompt: getMergeEvaluationPrompt(),
      model: 'gpt-5',
      temperature: 1,
      maxRetries: 1,
      maxTokens: 8192,
    },
    MergeEvaluationSchema
  );

  // 4. Fall back to create on failure or "create" decision
  if (!mergeResult.success) {
    console.log(`[Merge Eval] "${normalizedEntry.title}" — LLM failed (${mergeResult.error}), creating new`);
    const entry = await createEntry(projectId, normalizedEntry);
    const deprecatedEntryIds = await consolidateEntriesByTitle(projectId, entry);
    return { entry, ingestAction: { action: 'created', entryId: entry.id, deprecatedEntryIds } };
  }
  console.log(`[Merge Eval] "${normalizedEntry.title}" — decision: ${mergeResult.data.action} | target: ${mergeResult.data.target_entry_id} | reason: ${mergeResult.data.reasoning}`);
  if (mergeResult.data.action === 'create' ||
      !mergeResult.data.target_entry_id ||
      !mergeResult.data.merged_content) {
    const entry = await createEntry(projectId, normalizedEntry);
    const deprecatedEntryIds = await consolidateEntriesByTitle(projectId, entry);
    return {
      entry,
      ingestAction: {
        action: 'created',
        entryId: entry.id,
        reasoning: mergeResult.data.reasoning,
        deprecatedEntryIds,
      },
    };
  }

  const { target_entry_id, merged_content, reasoning } = mergeResult.data;

  // 5. Verify target still exists (guard against race conditions)
  const existingEntry = await getEntry(projectId, target_entry_id);
  if (!existingEntry) {
    console.log(`[Merge Eval] "${normalizedEntry.title}" — target ${target_entry_id} not found, creating new`);
    const entry = await createEntry(projectId, normalizedEntry);
    const deprecatedEntryIds = await consolidateEntriesByTitle(projectId, entry);
    return { entry, ingestAction: { action: 'created', entryId: entry.id, deprecatedEntryIds } };
  }
  console.log(`[Merge Eval] "${normalizedEntry.title}" — merging into "${existingEntry.data.title}" (${target_entry_id})`);

  // 6. Union tags (case-insensitive dedup)
  const existingTags = existingEntry.data.tags ?? [];
  const unionTags = [...existingTags];
  for (const tag of normalizedEntry.tags ?? []) {
    if (!unionTags.some(t => t.toLowerCase() === tag.toLowerCase())) {
      unionTags.push(tag);
    }
  }

  const mergedTitle = canonicalizeTitle(
    isWeakTitle(existingEntry.data.title) ? normalizedEntry.title : existingEntry.data.title,
    merged_content
  );

  // 7. Legacy entry IDs get superseded into a new canonical entry
  if (LEGACY_ENTRY_ID_PATTERN.test(target_entry_id)) {
    const replacementEntry = await createEntry(projectId, {
      title: mergedTitle,
      full_content: merged_content,
      tags: unionTags,
      date_detected: normalizedEntry.date_detected ?? existingEntry.data.date_detected,
      ingest_group_id: normalizedEntry.ingest_group_id ?? existingEntry.data.ingest_group_id,
      sources: Array.from(new Set([
        ...(existingEntry.data.sources ?? []),
        ...(normalizedEntry.sources ?? []),
      ])),
    });
    await deprecateEntry(projectId, target_entry_id, replacementEntry.id);
    const consolidatedIds = await consolidateEntriesByTitle(projectId, replacementEntry);
    return {
      entry: replacementEntry,
      ingestAction: {
        action: 'superseded',
        entryId: replacementEntry.id,
        reasoning: reasoning ?? undefined,
        mergedIntoTitle: existingEntry.data.title,
        deprecatedEntryIds: [target_entry_id, ...consolidatedIds],
      },
    };
  }

  // 8. Update existing entry: merged content + union tags + newer date + union sources
  const entry = await updateEntry(projectId, target_entry_id, {
    title: mergedTitle,
    full_content: merged_content,
    tags: unionTags,
    date_detected: normalizedEntry.date_detected ?? existingEntry.data.date_detected,
    ingest_group_id: normalizedEntry.ingest_group_id ?? existingEntry.data.ingest_group_id,
    sources: Array.from(new Set([
      ...(existingEntry.data.sources ?? []),
      ...(normalizedEntry.sources ?? []),
    ])),
  });
  const deprecatedEntryIds = await consolidateEntriesByTitle(projectId, entry);
  return {
    entry,
    ingestAction: {
      action: 'merged',
      entryId: entry.id,
      reasoning: reasoning ?? undefined,
      mergedIntoTitle: existingEntry.data.title,
      deprecatedEntryIds,
    },
  };
}

// POST /api/feed/ingest - Ingest new knowledge
router.post('/ingest', async (req, res, next) => {
  try {
    const { content, sources, projectId, tags: userTags } = req.body;

    if (!content || typeof content !== 'string') {
      throw createError('content is required', 400);
    }

    const MAX_CONTENT_LENGTH = 50_000;
    if (content.length > MAX_CONTENT_LENGTH) {
      throw createError(`Content too large (${content.length} chars, max ${MAX_CONTENT_LENGTH})`, 400);
    }

    if (!projectId || typeof projectId !== 'string') {
      throw createError('projectId is required', 400);
    }

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    // Build user prompt with user-specified tags hint
    let userPrompt = `Content to process:\n\n${content}`;
    if (sources && Array.isArray(sources) && sources.length > 0) {
      userPrompt += `\n\nProvided sources:\n${sources.join('\n')}`;
    }
    if (userTags && Array.isArray(userTags) && userTags.length > 0) {
      userPrompt += `\n\nUser-specified tags (MUST include these): ${userTags.join(', ')}`;
    }

    // Call LLM to create entries (may split into multiple if multi-topic)
    // maxTokens set high to handle large file ingestion
    const result = await callLLM(
      {
        userPrompt,
        systemPrompt: getFeedIngestPrompt(),
        model: 'gpt-5-mini',
        temperature: 1,
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
    const ingestActions: IngestAction[] = [];
    const allSuggestedTags: string[] = [];
    const ingestGroupId = generateIngestGroupId('app');

    for (const entryData of result.data.entries) {
      // Ensure sources are set if provided
      if (sources && Array.isArray(sources) && sources.length > 0 && (!entryData.sources || entryData.sources.length === 0)) {
        entryData.sources = sources;
      }

      // Merge user-specified tags with LLM-generated tags
      const mergedTags = [...(entryData.tags || [])];
      if (userTags && Array.isArray(userTags)) {
        for (const tag of userTags) {
          if (!mergedTags.some(t => t.toLowerCase() === tag.toLowerCase())) {
            mergedTags.push(tag);
          }
        }
      }

      // LLM fuzzy-match unmatched tags to predefined ones
      const unmatchedTags = mergedTags.filter(t => !normalizeToPrefinedTag(t));
      if (unmatchedTags.length > 0) {
        const normPrompt = buildTagNormalizationPrompt(unmatchedTags);
        if (normPrompt) {
          try {
            const normResult = await callLLM(
              { userPrompt: normPrompt.user, systemPrompt: normPrompt.system, model: 'gpt-5-mini', temperature: 1, maxRetries: 0, maxTokens: 1024 },
              TagNormalizationSchema
            );
            if (normResult.success && normResult.data.mappings) {
              for (let i = 0; i < mergedTags.length; i++) {
                const mapped = normResult.data.mappings[mergedTags[i]];
                if (mapped && mapped !== mergedTags[i]) {
                  mergedTags[i] = mapped;
                }
              }
            }
          } catch {
            // Normalization is best-effort; continue with original tags
          }
        }
      }

      // Normalize and validate tags against predefined list
      const { tags, invalidTags } = normalizeTags(mergedTags, entryData.suggested_new_tags);

      // Preserve user-provided tags even if not in predefined list
      if (userTags && Array.isArray(userTags)) {
        for (const tag of userTags) {
          if (!tags.some(t => t.toLowerCase() === tag.toLowerCase())) {
            tags.push(tag);
          }
        }
      }

      // Ensure every entry has at least one tag
      if (tags.length === 0) {
        if (userTags && Array.isArray(userTags) && userTags.length > 0) {
          tags.push(...userTags);
        } else {
          tags.push('Announcement');
        }
      }

      entryData.tags = tags;
      entryData.ingest_group_id = ingestGroupId;

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

      const { entry, ingestAction } = await evaluateAndSave(projectId, entryData);
      createdEntries.push(entry);
      ingestActions.push(ingestAction);
    }

    // Recompile KB index
    await compileKB(projectId);

    res.status(201).json({
      entries: createdEntries,
      count: createdEntries.length,
      suggestedNewTags: allSuggestedTags.length > 0 ? allSuggestedTags : undefined,
      actions: ingestActions,
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
        model: 'gpt-5-mini',
        temperature: 1,
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

// PATCH /api/feed/entries/:projectId/:entryId/tags - Update entry tags
router.patch('/entries/:projectId/:entryId/tags', async (req, res, next) => {
  try {
    const { projectId, entryId } = req.params;
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw createError('tags array is required and must not be empty', 400);
    }

    const project = await getProject(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    const entry = await getEntry(projectId, entryId);
    if (!entry) {
      throw createError('Entry not found', 404);
    }

    const { tags: normalizedTags } = normalizeTags(tags);

    // Preserve any tags not in predefined list (user custom tags)
    const finalTags = [...normalizedTags];
    for (const tag of tags) {
      if (!finalTags.some(t => t.toLowerCase() === tag.toLowerCase())) {
        finalTags.push(tag);
      }
    }

    const updated = await updateEntry(projectId, entryId, { tags: finalTags });

    res.json({ entry: updated });
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

    const results: Array<{ uri: string; success: boolean; entry?: Entry; ingestAction?: IngestAction; error?: string }> = [];

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
          const ingestGroupId = generateIngestGroupId('mcp');
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
              model: 'gpt-5-mini',
              temperature: 1,
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
            entryData.ingest_group_id = ingestGroupId;
            const { entry, ingestAction } = await evaluateAndSave(projectId, entryData);
            results.push({ uri: resource.uri, success: true, entry, ingestAction });
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
