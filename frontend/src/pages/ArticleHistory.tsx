import { useState, useEffect, useMemo } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { DebateViewer } from '../components/DebateViewer';
import { MiniScoreRing } from '../components/charts/ScoreBar';
import { articlesApi } from '../services/api';
import { articlesStorage } from '../services/localStorage';
import type { ArticleSummary, ArticleResult } from '../features/articles/types';

type ViewState = 'list' | 'detail';
type SortField = 'date' | 'score' | 'words' | 'cost';
type SortDir = 'asc' | 'desc';

const JUDGE_COLORS: Record<string, string> = {
  ChatGPT: '#34d399',
  Gemini: '#60a5fa',
  Grok: '#fb923c',
};

export default function ArticleHistory() {
  const [viewState, setViewState] = useState<ViewState>('list');
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<ArticleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'high' | 'mid' | 'low'>('all');

  useEffect(() => {
    const cached = articlesStorage.getSummaries();
    if (cached.length > 0) {
      setArticles(cached);
      setLoading(false);
    }
    loadArticles();
  }, []);

  async function loadArticles() {
    setLoading(true);
    setError(null);
    try {
      const result = await articlesApi.list();
      setArticles(result.articles);
      articlesStorage.setSummaries(result.articles);
    } catch (err) {
      const cached = articlesStorage.getSummaries();
      if (cached.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to load articles');
      }
    } finally {
      setLoading(false);
    }
  }

  async function openArticle(id: string) {
    setLoadingDetail(true);
    setError(null);

    const cached = articlesStorage.getArticle(id);
    if (cached) {
      setSelectedArticle(cached);
      setViewState('detail');
      setLoadingDetail(false);
    }

    try {
      const article = await articlesApi.get(id);
      setSelectedArticle(article);
      articlesStorage.setArticle(article);
      setViewState('detail');
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : 'Failed to load article');
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  function backToList() {
    setSelectedArticle(null);
    setViewState('list');
  }

  const filteredSorted = useMemo(() => {
    let result = [...articles];

    if (scoreFilter !== 'all') {
      result = result.filter((a) => {
        if (scoreFilter === 'high') return a.overallScore >= 9;
        if (scoreFilter === 'mid') return a.overallScore >= 7 && a.overallScore < 9;
        return a.overallScore < 7;
      });
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === 'score') cmp = a.overallScore - b.overallScore;
      else if (sortField === 'words') cmp = a.wordCount - b.wordCount;
      else if (sortField === 'cost') cmp = a.budgetUsed - b.budgetUsed;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [articles, sortField, sortDir, scoreFilter]);

  const stats = useMemo(() => {
    if (articles.length === 0) return null;
    const scores = articles.map((a) => a.overallScore);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const totalCost = articles.reduce((s, a) => s + a.budgetUsed, 0);
    const highCount = scores.filter((s) => s >= 9).length;
    return { avg, totalCost, highCount, total: articles.length };
  }, [articles]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  if (loading && articles.length === 0) {
    return <LoadingSpinner message="Loading article history..." />;
  }

  if (viewState === 'detail' && selectedArticle) {
    return <ArticleDetailView article={selectedArticle} onBack={backToList} />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header with Stats */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-300/20 to-amber-500/20 border border-amber-400/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-display font-bold text-cream-50">Article History</h2>
            <p className="text-xs text-smoke-200">{articles.length} articles generated</p>
          </div>
          <Button variant="secondary" onClick={loadArticles} className="!py-1.5 !px-3 !text-xs">
            Refresh
          </Button>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            <div className="px-3 py-2 rounded-lg bg-void-300/40 border border-smoke-400/15">
              <div className="text-lg font-display font-bold text-cream-50">{stats.total}</div>
              <div className="text-[10px] text-smoke-200 uppercase tracking-wider">Total</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-void-300/40 border border-smoke-400/15">
              <div className="text-lg font-display font-bold text-amber-300">{stats.avg.toFixed(1)}</div>
              <div className="text-[10px] text-smoke-200 uppercase tracking-wider">Avg Score</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-jade-500/8 border border-jade-500/15">
              <div className="text-lg font-display font-bold text-jade-400">{stats.highCount}</div>
              <div className="text-[10px] text-jade-300/60 uppercase tracking-wider">Score 9+</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-void-300/40 border border-smoke-400/15">
              <div className="text-lg font-display font-bold text-cream-100">${stats.totalCost.toFixed(2)}</div>
              <div className="text-[10px] text-smoke-200 uppercase tracking-wider">Total Cost</div>
            </div>
          </div>
        )}

        {/* Score Trend Mini Chart */}
        {articles.length >= 3 && (
          <div className="mt-4 pt-3 border-t border-smoke-400/15">
            <ScoreTrendChart articles={articles} />
          </div>
        )}
      </Card>

      {error && (
        <Card className="!border-coral-500/30 !bg-coral-500/5">
          <p className="text-coral-400 text-sm">{error}</p>
        </Card>
      )}

      {/* Filters + Sort Bar */}
      {articles.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-1">
          {/* Score Filter */}
          <div className="flex gap-1 p-0.5 bg-void-300/30 rounded-lg border border-smoke-400/15">
            {([
              { key: 'all', label: 'All' },
              { key: 'high', label: '9+' },
              { key: 'mid', label: '7-9' },
              { key: 'low', label: '<7' },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setScoreFilter(f.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  scoreFilter === f.key
                    ? 'bg-amber-400/15 text-amber-300 border border-amber-400/25'
                    : 'text-smoke-200 hover:text-cream-100 border border-transparent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort buttons */}
          <div className="flex gap-1">
            {([
              { key: 'date', label: 'Date' },
              { key: 'score', label: 'Score' },
              { key: 'words', label: 'Words' },
              { key: 'cost', label: 'Cost' },
            ] as const).map((s) => (
              <button
                key={s.key}
                onClick={() => toggleSort(s.key)}
                className={`px-2 py-1 rounded text-[11px] transition-colors flex items-center gap-1 ${
                  sortField === s.key ? 'text-amber-300' : 'text-smoke-200 hover:text-cream-100'
                }`}
              >
                {s.label}
                {sortField === s.key && (
                  <svg
                    className={`w-3 h-3 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {loadingDetail && <LoadingSpinner message="Loading article..." />}

      {/* Article List */}
      {filteredSorted.length === 0 && !loading && (
        <Card>
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-smoke-400/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-smoke-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-smoke-100">
              {articles.length === 0 ? 'No articles generated yet.' : 'No articles match the current filter.'}
            </p>
            {articles.length === 0 && (
              <p className="text-xs text-smoke-200 mt-2">Generate articles from the Articles tab.</p>
            )}
          </div>
        </Card>
      )}

      {filteredSorted.length > 0 && (
        <div className="space-y-2">
          {filteredSorted.map((article) => (
            <ArticleListCard
              key={article.id}
              article={article}
              onClick={() => openArticle(article.id)}
              disabled={loadingDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ARTICLE LIST CARD
   ═══════════════════════════════════════════ */

interface ArticleListCardProps {
  article: ArticleSummary;
  onClick: () => void;
  disabled: boolean;
}

function ArticleListCard({ article, onClick, disabled }: ArticleListCardProps) {
  const formattedDate = new Date(article.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <Card interactive>
      <button onClick={onClick} className="w-full text-left" disabled={disabled}>
        <div className="flex items-center gap-4">
          {/* Score Ring */}
          <MiniScoreRing score={article.overallScore} size={44} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-cream-50 truncate">{article.title}</h3>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-smoke-200">
              <span>{formattedDate}</span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                {article.wordCount.toLocaleString()} words
              </span>
              <span className="text-amber-300/50">${article.budgetUsed.toFixed(4)}</span>
            </div>
          </div>

          {/* Mini Score Bar - 3 key dims as tiny indicator */}
          <div className="hidden sm:flex flex-col gap-1 w-20">
            <MiniBar value={article.overallScore} max={10} label="Overall" />
          </div>

          {/* Arrow */}
          <svg className="w-4 h-4 text-smoke-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </button>
    </Card>
  );
}

function MiniBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = (value / max) * 100;
  const color = value >= 9 ? '#4ade80' : value >= 7 ? '#fbbf24' : '#f87171';
  return (
    <div>
      <div className="flex justify-between text-[9px]">
        <span className="text-smoke-300">{label}</span>
        <span style={{ color }} className="tabular-nums">{value.toFixed(1)}</span>
      </div>
      <div className="h-1 bg-void-300 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCORE TREND CHART
   ═══════════════════════════════════════════ */

interface ScoreTrendChartProps {
  articles: ArticleSummary[];
}

function ScoreTrendChart({ articles }: ScoreTrendChartProps) {
  const sorted = useMemo(() =>
    [...articles].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  [articles]);

  const width = 600;
  const height = 60;
  const padding = { top: 4, bottom: 4, left: 0, right: 0 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const minScore = Math.min(...sorted.map((a) => a.overallScore), 5);
  const maxScore = 10;

  const points = sorted.map((a, i) => {
    const x = padding.left + (i / Math.max(sorted.length - 1, 1)) * chartW;
    const y = padding.top + chartH - ((a.overallScore - minScore) / (maxScore - minScore)) * chartH;
    return { x, y, score: a.overallScore };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div>
      <p className="text-[10px] text-smoke-200 mb-1 uppercase tracking-wider">Score Trend</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 60 }}>
        {/* Area fill */}
        <path d={areaPath} fill="url(#trendGrad)" />
        {/* Line */}
        <path d={linePath} fill="none" stroke="#f5c638" strokeWidth={1.5} strokeLinejoin="round" />
        {/* Points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#f5c638" stroke="rgba(12,12,13,0.8)" strokeWidth={1} />
        ))}
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5c638" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f5c638" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ARTICLE DETAIL VIEW
   ═══════════════════════════════════════════ */

interface ArticleDetailViewProps {
  article: ArticleResult;
  onBack: () => void;
}

function ArticleDetailView({ article, onBack }: ArticleDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'article' | 'council'>('council');

  const opinions = Object.values(article.debate.r1.opinions);
  const avgScore = article.debate.r1.avg_scores.overall ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb + Title */}
      <Card>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 transition-colors mb-4"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to History
        </button>

        <div className="flex items-start gap-4">
          <MiniScoreRing score={avgScore} size={52} />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-display font-bold text-cream-50">{article.title}</h2>
            <div className="flex items-center gap-4 mt-1 text-xs text-smoke-200">
              <span>{article.wordCount.toLocaleString()} words</span>
              <span>${article.budget.total.toFixed(4)} spent</span>
              <span>{new Date(article.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {/* Judge verdict summary */}
            <div className="flex items-center gap-2 mt-2">
              {opinions.map((op) => (
                <span
                  key={op.judge}
                  className="flex items-center gap-1.5 text-[11px]"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: JUDGE_COLORS[op.judge] }} />
                  <span style={{ color: JUDGE_COLORS[op.judge] }}>{op.judge}</span>
                  <span className={`px-1 py-0.5 rounded text-[9px] ${
                    op.verdict === 'APPROVE' ? 'bg-jade-500/15 text-jade-400' :
                    op.verdict === 'REJECT' ? 'bg-coral-500/15 text-coral-400' :
                    'bg-honey-500/15 text-honey-400'
                  }`}>
                    {op.verdict}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 mt-5 p-0.5 bg-void-300/30 rounded-lg border border-smoke-400/15 w-fit">
          <button
            onClick={() => setActiveTab('council')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'council'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/25'
                : 'text-smoke-100 hover:text-cream-100 border border-transparent'
            }`}
          >
            Council Evaluation
          </button>
          <button
            onClick={() => setActiveTab('article')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'article'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/25'
                : 'text-smoke-100 hover:text-cream-100 border border-transparent'
            }`}
          >
            Article Content
          </button>
        </div>
      </Card>

      {/* Content based on active tab */}
      {activeTab === 'article' && (
        <Card>
          <div className="prose prose-invert prose-sm max-w-none bg-void-400/30 rounded-lg p-5 max-h-[70vh] overflow-y-auto">
            <div className="whitespace-pre-wrap text-cream-200 text-sm leading-relaxed">
              {article.content}
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={() => navigator.clipboard.writeText(article.content)}
              className="text-xs text-amber-300 hover:text-amber-200 transition-colors"
            >
              Copy to Clipboard
            </button>
          </div>
        </Card>
      )}

      {activeTab === 'council' && (
        <Card>
          <DebateViewer
            r1={article.debate.r1}
            r2={article.debate.r2}
            budget={article.budget}
            earlyStop={!article.debate.r2}
          />
        </Card>
      )}
    </div>
  );
}
