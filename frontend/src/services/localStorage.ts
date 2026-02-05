import type { VoiceSummary, ArticleSummary, ArticleResult } from '../features/articles/types';

const STORAGE_KEYS = {
  VOICES: 'tony-rea:voices',
  SELECTED_VOICE: 'tony-rea:selectedVoice',
  ARTICLE_SUMMARIES: 'tony-rea:articleSummaries',
  ARTICLES_CACHE: 'tony-rea:articlesCache',
  CURRENT_ARTICLE: 'tony-rea:currentArticle',
} as const;

function safeGet<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage write failed:', e);
  }
}

export const voicesStorage = {
  getVoices: (): VoiceSummary[] => safeGet(STORAGE_KEYS.VOICES) ?? [],

  setVoices: (voices: VoiceSummary[]): void => {
    safeSet(STORAGE_KEYS.VOICES, voices);
  },

  getSelectedVoice: (): VoiceSummary | null => safeGet(STORAGE_KEYS.SELECTED_VOICE),

  setSelectedVoice: (voice: VoiceSummary | null): void => {
    safeSet(STORAGE_KEYS.SELECTED_VOICE, voice);
  },

  updateVoice: (voice: VoiceSummary): void => {
    const voices = voicesStorage.getVoices();
    const idx = voices.findIndex((v) => v.handle === voice.handle);
    if (idx >= 0) {
      voices[idx] = voice;
    } else {
      voices.unshift(voice);
    }
    voicesStorage.setVoices(voices);
  },
};

export const articlesStorage = {
  getSummaries: (): ArticleSummary[] => safeGet(STORAGE_KEYS.ARTICLE_SUMMARIES) ?? [],

  setSummaries: (articles: ArticleSummary[]): void => {
    safeSet(STORAGE_KEYS.ARTICLE_SUMMARIES, articles);
  },

  getArticle: (id: string): ArticleResult | null => {
    const cache: Record<string, ArticleResult> = safeGet(STORAGE_KEYS.ARTICLES_CACHE) ?? {};
    return cache[id] ?? null;
  },

  setArticle: (article: ArticleResult): void => {
    const cache: Record<string, ArticleResult> = safeGet(STORAGE_KEYS.ARTICLES_CACHE) ?? {};
    cache[article.id] = article;
    safeSet(STORAGE_KEYS.ARTICLES_CACHE, cache);
  },

  getCurrentArticle: (): ArticleResult | null => safeGet(STORAGE_KEYS.CURRENT_ARTICLE),

  setCurrentArticle: (article: ArticleResult | null): void => {
    safeSet(STORAGE_KEYS.CURRENT_ARTICLE, article);
  },

  clearCurrentArticle: (): void => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ARTICLE);
  },
};
