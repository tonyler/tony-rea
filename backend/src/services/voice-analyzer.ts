import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { env } from '../config/env';
import { Article, scrapeArticles } from './x-scraper';
import { VoiceProfileSchema, VoiceProfileMeta } from '../schemas/voice-profile';
import type { VoiceProfile } from '../schemas/voice-profile';
import { callMultiLLM } from './multi-llm';
import { getSubAnalysisPrompt, getMergePrompt, getFullAnalysisPrompt } from '../prompts/voice-analysis';

export interface VoiceSummary {
  handle: string;
  scraped_at: string;
  article_count: number;
  top_article_count: number;
  has_profile?: boolean;
}

interface Manifest {
  handle: string;
  scraped_at: string;
  total_count: number;
}

function normalizeHandle(handle: string): string {
  const cleaned = handle.replace('@', '').trim().toLowerCase();
  if (cleaned.includes('..') || cleaned.includes('/') || cleaned.includes('\\') || !cleaned) {
    throw new Error('Invalid handle format');
  }
  return cleaned;
}

function getVoicesDir(): string {
  return path.join(env.DATA_DIR, 'voices');
}

function getHandleDir(handle: string): string {
  const clean = normalizeHandle(handle);
  return path.join(getVoicesDir(), clean);
}

function getArticlesDir(handle: string): string {
  return path.join(getHandleDir(handle), 'articles');
}

function getManifestPath(handle: string): string {
  return path.join(getHandleDir(handle), 'manifest.json');
}

function getTop10Path(handle: string): string {
  return path.join(getHandleDir(handle), 'top10.json');
}

function getProfilePath(handle: string): string {
  return path.join(getHandleDir(handle), 'profile.json');
}

function extractStatusId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

const TOP_ARTICLES_FOR_LLM = 10;

async function loadManifest(handle: string): Promise<Manifest | null> {
  try {
    const manifestPath = getManifestPath(handle);
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Fallback: check for legacy articles.json format
    try {
      const legacyPath = path.join(getHandleDir(handle), 'articles.json');
      const content = await fs.readFile(legacyPath, 'utf-8');
      const legacy = JSON.parse(content);
      return {
        handle: legacy.handle,
        scraped_at: legacy.scraped_at,
        total_count: legacy.total_count || legacy.articles?.length || 0,
      };
    } catch {
      return null;
    }
  }
}

async function loadAllArticles(handle: string): Promise<Article[]> {
  const articlesDir = getArticlesDir(handle);
  const articles: Article[] = [];

  try {
    const files = await fs.readdir(articlesDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(articlesDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        articles.push(JSON.parse(content));
      }
    }
  } catch {
    // Fallback: check for legacy articles.json format
    try {
      const legacyPath = path.join(getHandleDir(handle), 'articles.json');
      const content = await fs.readFile(legacyPath, 'utf-8');
      const legacy = JSON.parse(content);
      if (legacy.articles && Array.isArray(legacy.articles)) {
        articles.push(...legacy.articles);
      }
    } catch {
      return [];
    }
  }

  // Sort by score descending
  articles.sort((a, b) => b.score - a.score);
  return articles;
}

async function loadTop10(handle: string): Promise<Article[]> {
  try {
    const top10Path = getTop10Path(handle);
    const content = await fs.readFile(top10Path, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Fallback: check for legacy articles.json and return top 10
    try {
      const legacyPath = path.join(getHandleDir(handle), 'articles.json');
      const content = await fs.readFile(legacyPath, 'utf-8');
      const legacy = JSON.parse(content);
      if (legacy.articles && Array.isArray(legacy.articles)) {
        return legacy.articles.slice(0, TOP_ARTICLES_FOR_LLM);
      }
    } catch {
      return [];
    }
    return [];
  }
}

async function saveArticle(handle: string, article: Article): Promise<void> {
  const statusId = extractStatusId(article.url);
  if (!statusId) {
    console.warn(`Could not extract status ID from URL: ${article.url}`);
    return;
  }

  const articlesDir = getArticlesDir(handle);
  await fs.mkdir(articlesDir, { recursive: true });

  const filePath = path.join(articlesDir, `${statusId}.json`);
  await fs.writeFile(filePath, JSON.stringify(article, null, 2));
}

async function saveArticlesCache(handle: string, articles: Article[]): Promise<void> {
  const handleDir = getHandleDir(handle);
  await fs.mkdir(handleDir, { recursive: true });

  // Save each article as a separate JSON file
  for (const article of articles) {
    await saveArticle(handle, article);
  }

  // Save manifest
  const manifest: Manifest = {
    handle: normalizeHandle(handle),
    scraped_at: new Date().toISOString(),
    total_count: articles.length,
  };
  await fs.writeFile(getManifestPath(handle), JSON.stringify(manifest, null, 2));

  // Save top 10 for LLM use (already sorted by score)
  const top10 = articles.slice(0, TOP_ARTICLES_FOR_LLM);
  await fs.writeFile(getTop10Path(handle), JSON.stringify(top10, null, 2));
}

export async function getExampleArticles(handle: string): Promise<Article[]> {
  // First try to load from top10.json (pre-computed)
  const top10 = await loadTop10(handle);
  if (top10.length > 0) {
    return top10;
  }

  // Fallback: load all and slice
  const manifest = await loadManifest(handle);
  if (manifest) {
    const all = await loadAllArticles(handle);
    return all.slice(0, TOP_ARTICLES_FOR_LLM);
  }

  throw new Error(
    `No cached articles for ${handle}. Run refreshArticles to scrape them.`
  );
}

export async function getAllArticles(handle: string): Promise<Article[]> {
  const manifest = await loadManifest(handle);
  if (manifest) {
    return loadAllArticles(handle);
  }

  throw new Error(
    `No cached articles for ${handle}. Run refreshArticles to scrape them.`
  );
}

async function deleteVoiceData(handle: string): Promise<void> {
  const handleDir = getHandleDir(handle);
  try {
    await fs.rm(handleDir, { recursive: true, force: true });
    console.log(`Deleted old data for @${handle}`);
  } catch {
    // Directory might not exist, that's fine
  }
}

export async function refreshArticles(handle: string): Promise<Article[]> {
  const cleanHandle = normalizeHandle(handle);
  if (!cleanHandle) {
    throw new Error('X handle is required');
  }

  console.log(`Scraping articles for @${cleanHandle}...`);

  // Step 1: Scrape articles first (don't touch existing data yet)
  const articles = await scrapeArticles(cleanHandle);

  // Step 2: Only proceed if scrape was successful
  if (articles.length === 0) {
    throw new Error(`No articles found for @${cleanHandle}. Old data preserved.`);
  }

  // Step 3: Delete old data ONLY after successful scrape
  await deleteVoiceData(cleanHandle);

  // Step 4: Save new data
  await saveArticlesCache(cleanHandle, articles);
  console.log(`Cached ${articles.length} articles for @${cleanHandle}`);

  return articles;
}

export async function listCachedHandles(): Promise<string[]> {
  const voicesDir = getVoicesDir();
  try {
    const dirs = await fs.readdir(voicesDir);
    const handles: string[] = [];

    for (const dir of dirs) {
      try {
        const manifestPath = path.join(voicesDir, dir, 'manifest.json');
        await fs.access(manifestPath);
        handles.push(dir);
      } catch {
        // Skip if no manifest.json
      }
    }

    return handles;
  } catch {
    return [];
  }
}

async function profileExists(handle: string): Promise<boolean> {
  try {
    await fs.access(getProfilePath(normalizeHandle(handle)));
    return true;
  } catch {
    return false;
  }
}

export async function listVoiceSummaries(): Promise<VoiceSummary[]> {
  const handles = await listCachedHandles();
  const summaries: VoiceSummary[] = [];

  for (const handle of handles) {
    const manifest = await loadManifest(handle);
    if (manifest) {
      const hasProfile = await profileExists(handle);
      summaries.push({
        handle: manifest.handle,
        scraped_at: manifest.scraped_at,
        article_count: manifest.total_count,
        top_article_count: Math.min(manifest.total_count, TOP_ARTICLES_FOR_LLM),
        has_profile: hasProfile,
      });
    }
  }

  return summaries;
}

export async function getVoiceSummary(handle: string): Promise<VoiceSummary | null> {
  const manifest = await loadManifest(handle);
  if (!manifest) return null;

  const hasProfile = await profileExists(handle);
  return {
    handle: manifest.handle,
    scraped_at: manifest.scraped_at,
    article_count: manifest.total_count,
    top_article_count: Math.min(manifest.total_count, TOP_ARTICLES_FOR_LLM),
    has_profile: hasProfile,
  };
}

// =============================================================================
// VOICE PROFILE ANALYSIS
// =============================================================================

const BATCH_TARGET_CHARS = 60_000;

function formatArticlesForAnalysis(articles: Article[]): string {
  return articles
    .map((a, i) => `=== ARTICLE ${i + 1} (${a.views} views, ${a.likes} likes) ===\n${a.title}\n\n${a.content}`)
    .join('\n\n---\n\n');
}

function extractSnippetCandidates(articles: Article[]): string[] {
  const candidates: string[] = [];
  const top = articles.slice(0, 15);

  for (const article of top) {
    const sentences = article.content.split(/(?<=[.!?])\s+/);
    if (sentences.length >= 2) {
      candidates.push(sentences.slice(0, 2).join(' '));
      candidates.push(sentences.slice(-2).join(' '));
    }
  }
  return candidates;
}

function batchArticles(articles: Article[]): Article[][] {
  const batches: Article[][] = [];
  let currentBatch: Article[] = [];
  let currentChars = 0;

  for (const article of articles) {
    const articleChars = (article.title?.length || 0) + article.content.length;
    if (currentChars + articleChars > BATCH_TARGET_CHARS && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    currentBatch.push(article);
    currentChars += articleChars;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

export async function getVoiceProfile(handle: string): Promise<VoiceProfile | null> {
  const clean = normalizeHandle(handle);
  const profilePath = getProfilePath(clean);

  try {
    const content = await fs.readFile(profilePath, 'utf-8');
    const meta: VoiceProfileMeta = JSON.parse(content);
    return meta.profile;
  } catch {
    return null;
  }
}

export async function getVoiceProfileMeta(handle: string): Promise<VoiceProfileMeta | null> {
  const clean = normalizeHandle(handle);
  const profilePath = getProfilePath(clean);

  try {
    const content = await fs.readFile(profilePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

const SubAnalysisSchema = z.object({
  observations: z.object({
    mechanics: z.string().optional().default(''),
    lexicon: z.string().optional().default(''),
    rhetoric: z.string().optional().default(''),
    tone: z.string().optional().default(''),
    rhythm: z.string().optional().default(''),
    anti_patterns: z.string().optional().default(''),
    topics: z.string().optional().default(''),
    signature_phrases: z.array(z.string()).optional().default([]),
    notable_snippets: z.array(z.object({
      text: z.string(),
      why: z.string(),
    })).optional().default([]),
  }),
});

export async function analyzeVoiceProfile(handle: string): Promise<VoiceProfile> {
  const clean = normalizeHandle(handle);
  console.log(`[voice-profile] Starting analysis for @${clean}...`);

  const allArticles = await loadAllArticles(clean);
  if (allArticles.length === 0) {
    throw new Error(`No articles found for @${clean}. Scrape first.`);
  }

  const totalChars = allArticles.reduce((sum, a) => sum + (a.title?.length || 0) + a.content.length, 0);
  const snippetCandidates = extractSnippetCandidates(allArticles);
  console.log(`[voice-profile] ${allArticles.length} articles, ${totalChars} chars, ${snippetCandidates.length} snippet candidates`);

  let profile: VoiceProfile;

  if (totalChars <= BATCH_TARGET_CHARS) {
    // Single-batch: one comprehensive call
    console.log(`[voice-profile] Single batch (${totalChars} chars), using gpt-5.1 via Perplexity`);
    const formatted = formatArticlesForAnalysis(allArticles);
    const prompt = getFullAnalysisPrompt(formatted);

    const result = await callMultiLLM('gpt-5.1', {
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: 0.3,
      maxTokens: 4096,
    }, VoiceProfileSchema);

    if (!result.success || !result.data) {
      throw new Error(`Voice analysis failed: ${result.error}`);
    }

    profile = result.data;
    console.log(`[voice-profile] Single-batch analysis complete, cost: $${result.cost.toFixed(4)}`);
  } else {
    // Multi-batch: sub-analysis per batch, then merge
    const batches = batchArticles(allArticles);
    console.log(`[voice-profile] ${batches.length} batches, running sub-analyses with gpt-5-mini via Perplexity`);

    const subAnalyses: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const formatted = formatArticlesForAnalysis(batches[i]);
      const prompt = getSubAnalysisPrompt(formatted, i);

      const result = await callMultiLLM('gpt-5-mini', {
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.3,
        maxTokens: 4096,
      }, SubAnalysisSchema);

      if (result.success && result.data) {
        subAnalyses.push(JSON.stringify(result.data.observations, null, 2));
        console.log(`[voice-profile] Batch ${i + 1}/${batches.length} done, cost: $${result.cost.toFixed(4)}`);
      } else {
        console.warn(`[voice-profile] Batch ${i + 1} failed: ${result.error}, skipping`);
      }
    }

    if (subAnalyses.length === 0) {
      throw new Error('All sub-analyses failed');
    }

    // Merge phase
    console.log(`[voice-profile] Merging ${subAnalyses.length} sub-analyses with gpt-5.1 via Perplexity`);
    const mergePrompt = getMergePrompt(subAnalyses);

    const mergeResult = await callMultiLLM('gpt-5.1', {
      systemPrompt: mergePrompt.system,
      userPrompt: mergePrompt.user,
      temperature: 0.3,
      maxTokens: 4096,
    }, VoiceProfileSchema);

    if (!mergeResult.success || !mergeResult.data) {
      throw new Error(`Merge failed: ${mergeResult.error}`);
    }

    profile = mergeResult.data;
    console.log(`[voice-profile] Merge complete, cost: $${mergeResult.cost.toFixed(4)}`);
  }

  // Save profile
  const meta: VoiceProfileMeta = {
    handle: clean,
    analyzed_at: new Date().toISOString(),
    article_count: allArticles.length,
    model_used: totalChars <= BATCH_TARGET_CHARS ? 'gpt-5.1' : 'gpt-5-mini+gpt-5.1',
    profile,
  };

  const profilePath = getProfilePath(clean);
  await fs.writeFile(profilePath, JSON.stringify(meta, null, 2));
  console.log(`[voice-profile] Saved profile to ${profilePath}`);

  return profile;
}
