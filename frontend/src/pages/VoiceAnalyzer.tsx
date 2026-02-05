import { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { voicesApi } from '../services/api';
import { voicesStorage } from '../services/localStorage';
import type { VoiceSummary, ScrapedArticle } from '../features/articles/types';

export default function VoiceAnalyzer() {
  const [xHandle, setXHandle] = useState('');
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceSummary[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceSummary | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  useEffect(() => {
    const cachedVoices = voicesStorage.getVoices();
    const cachedSelected = voicesStorage.getSelectedVoice();

    if (cachedVoices.length > 0) {
      setVoices(cachedVoices);
      if (cachedSelected) {
        setSelectedVoice(cachedSelected);
      } else if (cachedVoices.length > 0) {
        setSelectedVoice(cachedVoices[0]);
      }
    }

    const loadVoices = async () => {
      setLoadingVoices(true);
      setError(null);
      try {
        const { voices } = await voicesApi.list();
        setVoices(voices);
        voicesStorage.setVoices(voices);

        if (voices.length > 0) {
          const targetHandle = cachedSelected?.handle || voices[0].handle;
          const full = await voicesApi.get(targetHandle);
          setSelectedVoice(full);
          voicesStorage.setSelectedVoice(full);
        }
      } catch (err) {
        if (cachedVoices.length === 0) {
          setError(err instanceof Error ? err.message : 'Failed to load voices');
        }
      } finally {
        setLoadingVoices(false);
      }
    };

    loadVoices();
  }, []);

  const handleSelectVoice = async (handle: string) => {
    setError(null);
    setSuccess(null);
    try {
      const voice = await voicesApi.get(handle);
      setSelectedVoice(voice);
      voicesStorage.setSelectedVoice(voice);
      voicesStorage.updateVoice(voice);
      setExpandedArticle(null);
    } catch (err) {
      const cached = voices.find((v) => v.handle === handle);
      if (cached) {
        setSelectedVoice(cached);
        voicesStorage.setSelectedVoice(cached);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load voice');
      }
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = xHandle.trim().replace('@', '');
    if (!trimmed) {
      setError('Please enter an X handle.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await voicesApi.refresh(trimmed);
      setSelectedVoice(result);
      voicesStorage.setSelectedVoice(result);
      voicesStorage.updateVoice(result);
      setVoices((prev) => {
        const updated = prev.filter((v) => v.handle !== result.handle);
        const newVoices = [result, ...updated];
        voicesStorage.setVoices(newVoices);
        return newVoices;
      });
      setSuccess(`Scraped ${result.article_count} articles for @${result.handle}. Top ${result.top_article_count} will be used for voice matching.`);
      setXHandle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const renderArticle = (article: ScrapedArticle, index: number) => {
    const isExpanded = expandedArticle === article.url;

    return (
      <div
        key={article.url}
        className="border border-smoke-400/20 rounded-lg p-4 hover:border-smoke-400/40 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-smoke-300 font-mono">#{index + 1}</span>
              <h4 className="text-sm font-medium text-cream-100 truncate">{article.title || 'Untitled'}</h4>
            </div>
            <div className="flex items-center gap-4 text-xs text-smoke-200">
              <span>{formatNumber(article.views)} views</span>
              <span>{formatNumber(article.likes)} likes</span>
              <span className="text-emerald-400">Score: {formatNumber(article.score)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpandedArticle(isExpanded ? null : article.url)}
              className="text-xs text-smoke-100 hover:text-cream-100 transition-colors"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              View on X
            </a>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-smoke-400/20">
            <p className="text-sm text-smoke-100 whitespace-pre-wrap leading-relaxed">
              {article.content.slice(0, 2000)}
              {article.content.length > 2000 && '...'}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-300/20 to-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-cream-50">Voice Analyzer</h2>
        </div>

        <p className="text-sm text-smoke-100 mb-6">
          Scrape X articles to use as writing style examples. The top 10 articles by engagement are passed to Claude when generating content.
        </p>

        <form onSubmit={handleAnalyze} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">X Handle</label>
            <input
              type="text"
              value={xHandle}
              onChange={(e) => setXHandle(e.target.value)}
              placeholder="e.g., tonyler_"
              className="input"
              disabled={loadingVoices || analyzing}
            />
            <p className="text-xs text-smoke-200 mt-1.5">
              Enter the X handle (without @) to scrape their articles.
            </p>
          </div>

          <Button type="submit" disabled={analyzing || loadingVoices || !xHandle.trim()}>
            {analyzing ? 'Scraping...' : 'Scrape Articles'}
          </Button>
        </form>

        {loadingVoices && (
          <div className="mt-6">
            <LoadingSpinner message="Loading voices..." />
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-display font-semibold text-cream-50 mb-4">Saved Voices</h3>
        {voices.length === 0 ? (
          <p className="text-sm text-smoke-200">No voices yet. Scrape one above.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {voices.map((voice) => (
              <button
                key={voice.handle}
                onClick={() => handleSelectVoice(voice.handle)}
                className={`px-3 py-1.5 rounded-full text-xs tracking-wide transition-colors ${
                  selectedVoice?.handle === voice.handle
                    ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                    : 'bg-void-400/30 text-smoke-100 border border-smoke-400/20 hover:text-cream-100'
                }`}
              >
                @{voice.handle}
                <span className="ml-1 text-smoke-300">({voice.article_count})</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {error && (
        <Card className="!border-coral-500/30 !bg-coral-500/5">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-coral-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-coral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-coral-400 text-sm">
              <strong className="font-semibold">Error:</strong> {error}
            </p>
          </div>
        </Card>
      )}

      {success && (
        <Card className="!border-emerald-500/30 !bg-emerald-500/5">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-emerald-300 text-sm">
              <strong className="font-semibold">Success:</strong> {success}
            </p>
          </div>
        </Card>
      )}

      {analyzing && (
        <Card>
          <LoadingSpinner message="Scraping articles from X..." />
          <p className="text-xs text-smoke-200 text-center mt-2">
            This may take a minute depending on the number of articles.
          </p>
        </Card>
      )}

      {selectedVoice && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-display font-semibold text-cream-50">
              @{selectedVoice.handle}
            </h3>
            <div className="text-xs text-smoke-200">
              Scraped {new Date(selectedVoice.scraped_at).toLocaleDateString()}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-void-400/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-cream-100">{selectedVoice.article_count}</p>
              <p className="text-xs text-smoke-200">Total Articles</p>
            </div>
            <div className="bg-void-400/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{selectedVoice.top_article_count}</p>
              <p className="text-xs text-smoke-200">Used for Voice</p>
            </div>
            <div className="bg-void-400/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-cream-100">
                {selectedVoice.articles?.[0]?.score ? formatNumber(selectedVoice.articles[0].score) : '-'}
              </p>
              <p className="text-xs text-smoke-200">Top Score</p>
            </div>
          </div>

          {selectedVoice.articles && selectedVoice.articles.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-smoke-50">Top Articles (by engagement)</h4>
              {selectedVoice.articles.map((article, i) => renderArticle(article, i))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
