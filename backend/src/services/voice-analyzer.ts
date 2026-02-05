import * as fs from 'fs/promises';
import * as path from 'path';
import { env } from '../config/env';
import { Article, scrapeArticles } from './x-scraper';

export interface VoiceSummary {
  handle: string;
  scraped_at: string;
  article_count: number;
  top_article_count: number;
}

interface Manifest {
  handle: string;
  scraped_at: string;
  total_count: number;
}

function normalizeHandle(handle: string): string {
  return handle.replace('@', '').trim().toLowerCase();
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

export async function listVoiceSummaries(): Promise<VoiceSummary[]> {
  const handles = await listCachedHandles();
  const summaries: VoiceSummary[] = [];

  for (const handle of handles) {
    const manifest = await loadManifest(handle);
    if (manifest) {
      summaries.push({
        handle: manifest.handle,
        scraped_at: manifest.scraped_at,
        article_count: manifest.total_count,
        top_article_count: Math.min(manifest.total_count, TOP_ARTICLES_FOR_LLM),
      });
    }
  }

  return summaries;
}

export async function getVoiceSummary(handle: string): Promise<VoiceSummary | null> {
  const manifest = await loadManifest(handle);
  if (!manifest) return null;

  return {
    handle: manifest.handle,
    scraped_at: manifest.scraped_at,
    article_count: manifest.total_count,
    top_article_count: Math.min(manifest.total_count, TOP_ARTICLES_FOR_LLM),
  };
}
