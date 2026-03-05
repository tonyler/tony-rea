import { FeedIngestResult, MergeEvaluationSchema, TagNormalizationSchema } from '../schemas/output-schemas';
import { addPendingTag, buildTagNormalizationPrompt, normalizeToPrefinedTag } from '../config/tags';
import { callLLM } from './llm';
import { retrieveRelevantEntries } from './retrieval';
import {
  Entry,
  createEntry,
  deprecateEntry,
  getEntry,
  listEntries,
  updateEntry,
} from './storage';
import { buildMergeEvaluationUserPrompt, getMergeEvaluationPrompt } from '../prompts';

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

export interface CuratedIngestAction {
  action: 'created' | 'merged' | 'superseded';
  entryId: string;
  reasoning?: string;
  mergedIntoTitle?: string;
  deprecatedEntryIds?: string[];
}

export interface CuratedIngestResult {
  entry: Entry;
  ingestAction: CuratedIngestAction;
}

export interface CurateIngestOptions {
  defaultSources?: string[];
  defaultDate?: string;
  ingestGroupId?: string;
}

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

  if (hasSourceOverlap(canonicalEntry.data.sources, candidate.data.sources)) {
    return true;
  }

  if (
    canonicalEntry.data.date_detected &&
    candidate.data.date_detected &&
    canonicalEntry.data.date_detected === candidate.data.date_detected &&
    sharedTagCount(canonicalEntry.data.tags, candidate.data.tags) >= 2
  ) {
    return true;
  }

  const similarity = jaccardSimilarity(
    tokenizeForSimilarity(canonicalEntry.data.full_content ?? ''),
    tokenizeForSimilarity(candidate.data.full_content ?? '')
  );
  return similarity >= 0.72;
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

function normalizeTags(
  tags: string[] | null | undefined,
  suggestedNewTags?: string[] | null
): { tags: string[]; invalidTags: string[] } {
  const validated: string[] = [];
  const invalidTags: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags ?? []) {
    const normalized = normalizeToPrefinedTag(tag);
    if (!normalized) {
      invalidTags.push(tag);
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    validated.push(normalized);
  }

  for (const tag of suggestedNewTags ?? []) {
    if (!invalidTags.some((value) => value.toLowerCase() === tag.toLowerCase())) {
      invalidTags.push(tag);
    }
  }

  const lower = validated.map((tag) => tag.toLowerCase());
  const hasAMA = lower.includes('ama');
  const hasSpaces = lower.includes('spaces');
  const hasTwitter = lower.includes('twitter');

  if (hasAMA && !hasSpaces) {
    validated.push('Spaces');
  } else if (hasSpaces && !hasAMA) {
    validated.push('AMA');
  }
  if (hasSpaces && !hasTwitter) {
    validated.push('Twitter');
  }

  if (validated.length === 0) {
    validated.push('Announcement');
  }

  return { tags: validated, invalidTags };
}

async function normalizeAndTrackTags(entryData: FeedIngestResult): Promise<string[]> {
  const mergedTags = [...(entryData.tags ?? [])];
  const unmatchedTags = mergedTags.filter((tag) => !normalizeToPrefinedTag(tag));

  if (unmatchedTags.length > 0) {
    const normPrompt = buildTagNormalizationPrompt(unmatchedTags);
    if (normPrompt) {
      try {
        const normResult = await callLLM(
          {
            userPrompt: normPrompt.user,
            systemPrompt: normPrompt.system,
            maxRetries: 0,
            mode: 'feedUpdate',
          },
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
        // Best effort only; continue with original tags.
      }
    }
  }

  const { tags, invalidTags } = normalizeTags(mergedTags, entryData.suggested_new_tags);
  for (const tag of invalidTags) {
    addPendingTag(tag, 'llm');
  }
  return tags;
}

async function normalizeEntryData(entryData: FeedIngestResult, options?: CurateIngestOptions): Promise<FeedIngestResult> {
  const sources = entryData.sources && entryData.sources.length > 0
    ? entryData.sources
    : (options?.defaultSources ?? []);
  const tags = await normalizeAndTrackTags(entryData);

  return {
    title: canonicalizeTitle(entryData.title, entryData.full_content),
    full_content: entryData.full_content,
    date_detected: entryData.date_detected ?? options?.defaultDate ?? null,
    ingest_group_id: entryData.ingest_group_id ?? options?.ingestGroupId ?? null,
    tags,
    sources,
  };
}

async function consolidateEntriesByTitle(projectId: string, canonicalEntry: Entry): Promise<string[]> {
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

export async function curateAndSaveIngestEntry(
  projectId: string,
  entryData: FeedIngestResult,
  options?: CurateIngestOptions
): Promise<CuratedIngestResult> {
  const normalizedEntry = await normalizeEntryData(entryData, options);

  // 1. Retrieve likely related entries
  let existingEntries: Entry[] = [];
  try {
    const retrievalQuery = `${normalizedEntry.title} ${normalizedEntry.full_content.substring(0, 200)}`;
    const retrieval = await retrieveRelevantEntries(projectId, retrievalQuery);
    existingEntries = retrieval.entries.slice(0, 10);
  } catch {
    existingEntries = [];
  }

  // 2. If nothing looks related, create canonical entry directly
  if (existingEntries.length === 0) {
    const entry = await createEntry(projectId, normalizedEntry);
    const deprecatedEntryIds = await consolidateEntriesByTitle(projectId, entry);
    return { entry, ingestAction: { action: 'created', entryId: entry.id, deprecatedEntryIds } };
  }

  // 3. Ask LLM whether to create or merge
  const candidateForPrompt = {
    title: normalizedEntry.title,
    full_content: normalizedEntry.full_content,
    date_detected: normalizedEntry.date_detected,
    tags: normalizedEntry.tags ?? [],
  };
  const existingForPrompt = existingEntries.map((entry) => ({
    id: entry.id,
    title: entry.data.title,
    full_content: entry.data.full_content,
    date_detected: entry.data.date_detected,
    tags: entry.data.tags ?? [],
  }));

  const mergeResult = await callLLM(
    {
      userPrompt: buildMergeEvaluationUserPrompt(candidateForPrompt, existingForPrompt),
      systemPrompt: getMergeEvaluationPrompt(),
      maxRetries: 1,
      mode: 'feedUpdate',
    },
    MergeEvaluationSchema
  );

  if (!mergeResult.success ||
      mergeResult.data.action === 'create' ||
      !mergeResult.data.target_entry_id ||
      !mergeResult.data.merged_content) {
    const entry = await createEntry(projectId, normalizedEntry);
    const deprecatedEntryIds = await consolidateEntriesByTitle(projectId, entry);
    return {
      entry,
      ingestAction: {
        action: 'created',
        entryId: entry.id,
        reasoning: mergeResult.success ? mergeResult.data.reasoning : mergeResult.error,
        deprecatedEntryIds,
      },
    };
  }

  const { target_entry_id, merged_content, reasoning } = mergeResult.data;

  // 4. Merge target might disappear in races; fallback to create
  const existingEntry = await getEntry(projectId, target_entry_id);
  if (!existingEntry) {
    const entry = await createEntry(projectId, normalizedEntry);
    const deprecatedEntryIds = await consolidateEntriesByTitle(projectId, entry);
    return { entry, ingestAction: { action: 'created', entryId: entry.id, deprecatedEntryIds } };
  }

  // 5. Merge tags/sources and prefer stronger title
  const unionTags = [...(existingEntry.data.tags ?? [])];
  for (const tag of normalizedEntry.tags ?? []) {
    if (!unionTags.some((existingTag) => existingTag.toLowerCase() === tag.toLowerCase())) {
      unionTags.push(tag);
    }
  }
  const mergedTitle = canonicalizeTitle(
    isWeakTitle(existingEntry.data.title) ? normalizedEntry.title : existingEntry.data.title,
    merged_content
  );
  const mergedSources = Array.from(new Set([
    ...(existingEntry.data.sources ?? []),
    ...(normalizedEntry.sources ?? []),
  ]));
  const mergedDate = normalizedEntry.date_detected ?? existingEntry.data.date_detected;

  // 6. Legacy entry IDs are replaced by canonical slug IDs
  if (LEGACY_ENTRY_ID_PATTERN.test(target_entry_id)) {
    const replacementEntry = await createEntry(projectId, {
      title: mergedTitle,
      full_content: merged_content,
      tags: unionTags,
      sources: mergedSources,
      ingest_group_id: normalizedEntry.ingest_group_id ?? existingEntry.data.ingest_group_id,
      date_detected: mergedDate,
    });
    await deprecateEntry(projectId, target_entry_id, replacementEntry.id);
    const consolidatedIds = await consolidateEntriesByTitle(projectId, replacementEntry);
    return {
      entry: replacementEntry,
      ingestAction: {
        action: 'superseded',
        entryId: replacementEntry.id,
        mergedIntoTitle: existingEntry.data.title,
        reasoning,
        deprecatedEntryIds: [target_entry_id, ...consolidatedIds],
      },
    };
  }

  // 7. Update existing canonical entry in place
  const entry = await updateEntry(projectId, target_entry_id, {
    title: mergedTitle,
    full_content: merged_content,
    tags: unionTags,
    sources: mergedSources,
    ingest_group_id: normalizedEntry.ingest_group_id ?? existingEntry.data.ingest_group_id,
    date_detected: mergedDate,
  });
  const deprecatedEntryIds = await consolidateEntriesByTitle(projectId, entry);
  return {
    entry,
    ingestAction: {
      action: 'merged',
      entryId: entry.id,
      mergedIntoTitle: existingEntry.data.title,
      reasoning,
      deprecatedEntryIds,
    },
  };
}
