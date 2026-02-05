import { useState, useEffect } from 'react';
import type { ArticleResult, ArticleSummary, LLMConfig } from '../types';
import { articlesApi } from '../../../services/api';
import { articlesStorage } from '../../../services/localStorage';

const DEFAULT_LLM_CONFIG: LLMConfig = {
  draftModel: 'claude-sonnet-4-5',
  revisionModel: 'claude-sonnet-4-5',
  searchMode: 'full',
  councilMode: 'standard',
  judges: [
    { model: 'sonar', role: 'fact-checker' },
    { model: 'gemini-2.5-flash', role: 'originality-reviewer' },
    { model: 'grok-4-1-fast-x', role: 'slop-detector' },
    { model: 'gemini-2.5-flash', role: 'rules-enforcer' },
  ],
};

export function useArticles() {
  const [voiceHandle, setVoiceHandle] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [wordCount, setWordCount] = useState(1200);
  const [constraints, setConstraints] = useState('');
  const [llmConfig, setLLMConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG);

  const [generating, setGenerating] = useState(false);
  const [article, setArticle] = useState<ArticleResult | null>(() => articlesStorage.getCurrentArticle());
  const [savedArticles, setSavedArticles] = useState<ArticleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [reviseInstruction, setReviseInstruction] = useState('');
  const [revising, setRevising] = useState(false);

  const [loadingArticles, setLoadingArticles] = useState(false);

  useEffect(() => {
    if (article) {
      articlesStorage.setCurrentArticle(article);
    }
  }, [article]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceHandle || !content.trim()) return;

    setGenerating(true);
    setError(null);
    setArticle(null);

    try {
      const result = await articlesApi.generate(voiceHandle, content, wordCount, constraints || undefined, projectId || undefined, llmConfig);
      setArticle(result);
      articlesStorage.setArticle(result);
      setContent('');
      setConstraints('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleQuickRevise = async () => {
    if (!article || !reviseInstruction.trim()) return;

    setRevising(true);
    setError(null);

    try {
      const result = await articlesApi.revise(article.id, reviseInstruction, true);
      setArticle(result);
      articlesStorage.setArticle(result);
      setReviseInstruction('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revision failed');
    } finally {
      setRevising(false);
    }
  };

  const handleFullReCouncil = async () => {
    if (!article || !reviseInstruction.trim()) return;

    setRevising(true);
    setError(null);

    try {
      const result = await articlesApi.revise(article.id, reviseInstruction, false);
      setArticle(result);
      articlesStorage.setArticle(result);
      setReviseInstruction('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-council failed');
    } finally {
      setRevising(false);
    }
  };

  const loadSavedArticles = async () => {
    const cached = articlesStorage.getSummaries();
    if (cached.length > 0) {
      setSavedArticles(cached);
    }

    setLoadingArticles(true);
    try {
      const { articles } = await articlesApi.list();
      setSavedArticles(articles);
      articlesStorage.setSummaries(articles);
    } catch (err) {
      if (cached.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to load articles');
      }
    } finally {
      setLoadingArticles(false);
    }
  };

  const clearArticle = () => {
    setArticle(null);
    articlesStorage.clearCurrentArticle();
    setError(null);
    setReviseInstruction('');
  };

  return {
    voiceHandle,
    setVoiceHandle,
    projectId,
    setProjectId,
    content,
    setContent,
    wordCount,
    setWordCount,
    constraints,
    setConstraints,
    llmConfig,
    setLLMConfig,
    generating,
    article,
    error,
    handleGenerate,
    reviseInstruction,
    setReviseInstruction,
    revising,
    handleQuickRevise,
    handleFullReCouncil,
    savedArticles,
    loadingArticles,
    loadSavedArticles,
    clearArticle,
  };
}
