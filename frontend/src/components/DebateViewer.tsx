import { useState } from 'react';
import type { DebateRound, BudgetTracker, QualityScores, JudgeOpinion } from '../features/articles/types';
import { VerificationReportModal } from './VerificationReportModal';
import { RadarChart, DIMENSIONS, DIMENSION_LABELS } from './charts/RadarChart';
import { ScoreBar, MiniScoreRing, SourcePie } from './charts/ScoreBar';

interface DebateViewerProps {
  r1: DebateRound;
  r2: DebateRound | null;
  budget: BudgetTracker;
  earlyStop?: boolean;
}

interface JudgeStyle {
  bg: string; text: string; border: string; color: string;
  accent: string; capability: string; capIcon: string;
}

const JUDGE_ICON_SEARCH = 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z';
const JUDGE_ICON_X = 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z';
const JUDGE_ICON_DEFAULT = 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

const PROVIDER_STYLES: Record<string, { bg: string; text: string; border: string; color: string; accent: string }> = {
  perplexity: { bg: 'bg-cyan-500/8', text: 'text-cyan-400', border: 'border-cyan-500/25', color: '#22d3ee', accent: 'cyan' },
  anthropic: { bg: 'bg-violet-500/8', text: 'text-violet-400', border: 'border-violet-500/25', color: '#a78bfa', accent: 'violet' },
  openai: { bg: 'bg-emerald-500/8', text: 'text-emerald-400', border: 'border-emerald-500/25', color: '#34d399', accent: 'emerald' },
  google: { bg: 'bg-blue-500/8', text: 'text-blue-400', border: 'border-blue-500/25', color: '#60a5fa', accent: 'blue' },
  xai: { bg: 'bg-orange-500/8', text: 'text-orange-400', border: 'border-orange-500/25', color: '#fb923c', accent: 'orange' },
};

function getProviderFromModel(model: string): string {
  if (model.includes('claude')) return 'anthropic';
  if (model.includes('gpt')) return 'openai';
  if (model.includes('gemini')) return 'google';
  if (model.includes('grok')) return 'xai';
  if (model.includes('sonar')) return 'perplexity';
  return 'perplexity';
}

function getCapabilityFromModel(model: string): { capability: string; capIcon: string } {
  if (model.includes('grok') && model.includes('-x')) return { capability: 'X Search', capIcon: JUDGE_ICON_X };
  if (model.includes('sonar')) return { capability: 'Web Search', capIcon: JUDGE_ICON_SEARCH };
  if (model.includes('gpt') || model.includes('gemini')) return { capability: 'Web Search', capIcon: JUDGE_ICON_SEARCH };
  return { capability: 'Judge', capIcon: JUDGE_ICON_DEFAULT };
}

const FALLBACK_PALETTE: Array<{ bg: string; text: string; border: string; color: string; accent: string }> = [
  { bg: 'bg-emerald-500/8', text: 'text-emerald-400', border: 'border-emerald-500/25', color: '#34d399', accent: 'emerald' },
  { bg: 'bg-blue-500/8', text: 'text-blue-400', border: 'border-blue-500/25', color: '#60a5fa', accent: 'blue' },
  { bg: 'bg-orange-500/8', text: 'text-orange-400', border: 'border-orange-500/25', color: '#fb923c', accent: 'orange' },
  { bg: 'bg-violet-500/8', text: 'text-violet-400', border: 'border-violet-500/25', color: '#a78bfa', accent: 'violet' },
  { bg: 'bg-cyan-500/8', text: 'text-cyan-400', border: 'border-cyan-500/25', color: '#22d3ee', accent: 'cyan' },
];

function getJudgeConfig(name: string, index: number): JudgeStyle {
  const provider = getProviderFromModel(name);
  const providerStyle = PROVIDER_STYLES[provider] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
  const { capability, capIcon } = getCapabilityFromModel(name);
  return { ...providerStyle, capability, capIcon };
}


const DIMENSION_WEIGHTS: Record<string, number> = {
  ai_slop: 3, source_credibility: 3, repetition_density: 2, human_voice: 2,
  originality: 2, buzzword_density: 1.5, honesty_signals: 1, emotional_authenticity: 1,
  specificity: 1, jargon_accessibility: 0.5, reader_respect: 0.5,
};

function hasVerificationData(r1: DebateRound, r2: DebateRound | null): boolean {
  const checkRound = (round: DebateRound) =>
    Object.values(round.opinions).some(
      (op) => op.fact_check_report?.claims && op.fact_check_report.claims.length > 0
    );
  return checkRound(r1) || (r2 ? checkRound(r2) : false);
}

function getVerdictStyle(verdict: string): string {
  if (verdict === 'APPROVE') return 'bg-jade-500/15 text-jade-400 border-jade-500/30';
  if (verdict === 'REJECT') return 'bg-coral-500/15 text-coral-400 border-coral-500/30';
  return 'bg-honey-500/15 text-honey-400 border-honey-500/30';
}

export function DebateViewer({ r1, r2, budget, earlyStop }: DebateViewerProps) {
  const [activeRound, setActiveRound] = useState<1 | 2>(1);
  const [expandedJudge, setExpandedJudge] = useState<string | null>(null);
  const [activeDimension, setActiveDimension] = useState<keyof QualityScores | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const currentRound = activeRound === 2 && r2 ? r2 : r1;
  const opinions = Object.values(currentRound.opinions);
  const hasVerification = hasVerificationData(r1, r2);

  const radarDatasets = opinions.map((op, i) => ({
    label: op.judge,
    scores: op.quality_scores,
    color: getJudgeConfig(op.judge, i).color,
    fillOpacity: expandedJudge && expandedJudge !== op.judge ? 0.03 : 0.12,
  }));

  const handleDimensionClick = (dim: keyof QualityScores) => {
    setActiveDimension(activeDimension === dim ? null : dim);
  };

  const toggleJudge = (judge: string) => {
    setExpandedJudge(expandedJudge === judge ? null : judge);
  };

  return (
    <div className="space-y-5">
      {/* Round Tabs + Budget Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 p-1 bg-void-300/40 rounded-lg border border-smoke-400/20">
          <button
            onClick={() => setActiveRound(1)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeRound === 1
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/25'
                : 'text-smoke-100 hover:text-cream-100 border border-transparent'
            }`}
          >
            Round 1
            <span className="ml-1.5 text-[10px] opacity-70">
              {r1.avg_scores.overall?.toFixed(1) || '—'}
            </span>
          </button>
          {r2 && (
            <button
              onClick={() => setActiveRound(2)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeRound === 2
                  ? 'bg-amber-400/15 text-amber-300 border border-amber-400/25'
                  : 'text-smoke-100 hover:text-cream-100 border border-transparent'
              }`}
            >
              Round 2
              <span className="ml-1.5 text-[10px] opacity-70">
                {r2.avg_scores.overall?.toFixed(1) || '—'}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-smoke-200">
          <span>${budget.total.toFixed(4)} / ${budget.maxBudget.toFixed(2)}</span>
          <div className="w-20 h-1.5 bg-void-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-coral-500 rounded-full"
              style={{ width: `${Math.min((budget.total / budget.maxBudget) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Early Stop */}
      {earlyStop && (
        <div className="flex items-center gap-2 px-3 py-2 bg-jade-500/8 border border-jade-500/20 rounded-lg">
          <div className="w-5 h-5 rounded-full bg-jade-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-jade-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-xs text-jade-300">Early stop — all judges approved with avg score above 9.0</span>
        </div>
      )}

      {/* Main Visualization: Radar + Judge Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
        {/* Radar Chart */}
        <div className="flex flex-col items-center">
          <RadarChart
            datasets={radarDatasets}
            size={280}
            onDimensionClick={handleDimensionClick}
            activeDimension={activeDimension}
          />
          {/* Legend */}
          <div className="flex gap-4 mt-2">
            {opinions.map((op, i) => {
              const cfg = getJudgeConfig(op.judge, i);
              return (
                <button
                  key={op.judge}
                  onClick={() => toggleJudge(op.judge)}
                  className={`flex items-center gap-1.5 text-[11px] transition-opacity ${
                    expandedJudge && expandedJudge !== op.judge ? 'opacity-30' : 'opacity-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className={cfg.text}>{op.judge}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Judge Summary Cards */}
        <div className="space-y-2">
          {opinions.map((opinion, idx) => {
            const cfg = getJudgeConfig(opinion.judge, idx);
            const isExpanded = expandedJudge === opinion.judge;
            const factReport = opinion.fact_check_report;

            return (
              <div
                key={opinion.judge}
                className={`rounded-xl border overflow-hidden transition-all duration-300 ${
                  isExpanded ? `${cfg?.border} ${cfg?.bg}` : 'border-smoke-400/20 hover:border-smoke-400/35'
                }`}
              >
                {/* Judge Header - Always visible, clickable */}
                <button
                  onClick={() => toggleJudge(opinion.judge)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-void-200/20 transition-colors"
                >
                  {/* Score ring */}
                  <MiniScoreRing score={opinion.overall} color={cfg?.color} size={38} />

                  {/* Name + capability */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${cfg?.text}`}>{opinion.judge}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getVerdictStyle(opinion.verdict)}`}>
                        {opinion.verdict}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <svg className="w-3 h-3 text-smoke-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={cfg?.capIcon} />
                      </svg>
                      <span className="text-[10px] text-smoke-200">{cfg?.capability}</span>
                      {factReport && factReport.claims.length > 0 && (
                        <span className="text-[10px] text-amber-300/70 ml-1">
                          {factReport.summary.total} claims verified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick scores preview */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    {(['ai_slop', 'human_voice', 'source_credibility'] as const).map((dim) => {
                      const s = opinion.quality_scores[dim] ?? 0;
                      return (
                        <div
                          key={dim}
                          className="text-[9px] text-smoke-200 text-center"
                          title={DIMENSION_LABELS[dim]}
                        >
                          <div className="w-8 h-1 rounded-full overflow-hidden bg-void-300">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${s * 10}%`,
                                backgroundColor: cfg?.color,
                                opacity: 0.7,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Expand chevron */}
                  <svg
                    className={`w-4 h-4 text-smoke-300 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <JudgeDetailPanel opinion={opinion} cfg={cfg} activeDimension={activeDimension} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dimension Comparison (when a dimension is selected) */}
      {activeDimension && (
        <DimensionComparison
          dimension={activeDimension}
          opinions={opinions}
          onClose={() => setActiveDimension(null)}
        />
      )}

      {/* Source Verification Summary */}
      {hasVerification && (
        <VerificationSummaryBar
          r1={r1}
          r2={r2}
          onViewDetails={() => setShowVerificationModal(true)}
        />
      )}

      {/* Consensus + Priority Fixes */}
      <FixesSummary round={r2 || r1} />

      {/* Budget Breakdown */}
      <BudgetBreakdown budget={budget} />

      <VerificationReportModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        r1={r1}
        r2={r2}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════ */

interface JudgeDetailPanelProps {
  opinion: JudgeOpinion;
  cfg: JudgeStyle;
  activeDimension: keyof QualityScores | null;
}

function JudgeDetailPanel({ opinion, cfg, activeDimension }: JudgeDetailPanelProps) {
  const [showAllScores, setShowAllScores] = useState(false);

  const sortedDimensions = [...DIMENSIONS].sort((a, b) => {
    const wa = DIMENSION_WEIGHTS[a] || 1;
    const wb = DIMENSION_WEIGHTS[b] || 1;
    return wb - wa;
  });

  const visibleDimensions = showAllScores ? sortedDimensions : sortedDimensions.slice(0, 6);

  return (
    <div className="px-4 pb-4 space-y-4 border-t border-smoke-400/15">
      {/* Reasoning */}
      <div className="mt-3">
        <p className="text-xs text-smoke-50 font-medium mb-1.5 uppercase tracking-wider">Reasoning</p>
        <p className="text-sm text-cream-200 leading-relaxed">{opinion.reasoning}</p>
      </div>

      {/* Score Bars */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-smoke-50 font-medium uppercase tracking-wider">Quality Scores</p>
          <button
            onClick={() => setShowAllScores(!showAllScores)}
            className="text-[10px] text-amber-300/70 hover:text-amber-300 transition-colors"
          >
            {showAllScores ? 'Show fewer' : `Show all ${DIMENSIONS.length}`}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {visibleDimensions.map((dim) => {
            const score = opinion.quality_scores[dim] ?? 0;
            const weight = DIMENSION_WEIGHTS[dim] || 1;
            return (
              <div
                key={dim}
                className={`${activeDimension === dim ? 'bg-amber-400/5 -mx-1 px-1 rounded' : ''}`}
              >
                <div className="flex items-center gap-1">
                  <ScoreBar
                    score={score}
                    color={cfg?.color}
                    height={5}
                    label={DIMENSION_LABELS[dim] || dim}
                    showValue
                  />
                  {weight >= 2 && (
                    <span className="text-[8px] text-smoke-300 flex-shrink-0" title={`Weight: ${weight}x`}>
                      {weight}x
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flagged Phrases */}
      {opinion.flagged_phrases && opinion.flagged_phrases.length > 0 && (
        <div>
          <p className="text-xs text-smoke-50 font-medium mb-2 uppercase tracking-wider">
            Flagged Phrases ({opinion.flagged_phrases.length})
          </p>
          <div className="space-y-1.5">
            {opinion.flagged_phrases.map((fp, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-coral-400 font-mono bg-coral-500/10 px-1.5 py-0.5 rounded text-[11px] flex-shrink-0 mt-0.5">
                  "{fp.phrase}"
                </span>
                <span className="text-smoke-200">{fp.fix}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Issues */}
      {opinion.top_issues && opinion.top_issues.length > 0 && (
        <div>
          <p className="text-xs text-smoke-50 font-medium mb-2 uppercase tracking-wider">
            Top Issues ({opinion.top_issues.length})
          </p>
          <div className="space-y-1.5">
            {opinion.top_issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-xs bg-void-400/40 rounded-lg px-3 py-2">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{
                    backgroundColor: issue.score < 6 ? 'rgba(248,113,113,0.15)' : issue.score < 8 ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.15)',
                    color: issue.score < 6 ? '#f87171' : issue.score < 8 ? '#fbbf24' : '#4ade80',
                  }}
                >
                  {issue.score.toFixed(1)}
                </span>
                <div>
                  <span className="text-cream-100 font-medium">{issue.dimension}</span>
                  <span className="text-smoke-200 ml-1.5">{issue.fix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fact Check Report Inline Summary */}
      {opinion.fact_check_report && opinion.fact_check_report.claims.length > 0 && (
        <FactCheckInline report={opinion.fact_check_report} />
      )}
    </div>
  );
}

interface FactCheckInlineProps {
  report: NonNullable<JudgeOpinion['fact_check_report']>;
}

function FactCheckInline({ report }: FactCheckInlineProps) {
  const { summary } = report;
  const sourceLabel = summary.verified_kb > 0 ? 'KB + Web' : summary.verified_web > 0 ? 'Web' : 'Analysis';

  return (
    <div className="bg-void-400/50 rounded-lg p-3 border border-smoke-400/15">
      <div className="flex items-center gap-3 mb-2">
        <SourcePie
          kbCount={summary.verified_kb}
          webCount={summary.verified_web}
          unverifiedCount={summary.unverified}
          size={36}
        />
        <div>
          <p className="text-xs text-smoke-50 font-medium">
            Verification via {sourceLabel}
          </p>
          <p className="text-[10px] text-smoke-200 mt-0.5">
            {summary.total} claims checked: {summary.verified_kb + summary.verified_web} verified, {summary.mismatches} mismatches, {summary.unverified} unverified
          </p>
        </div>
      </div>
      {summary.mismatches > 0 && (
        <div className="mt-2 pt-2 border-t border-smoke-400/15">
          <div className="flex items-center gap-1.5 text-[10px] text-coral-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>{summary.mismatches} fact mismatch{summary.mismatches > 1 ? 'es' : ''} detected</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface DimensionComparisonProps {
  dimension: keyof QualityScores;
  opinions: JudgeOpinion[];
  onClose: () => void;
}

function DimensionComparison({ dimension, opinions, onClose }: DimensionComparisonProps) {
  const weight = DIMENSION_WEIGHTS[dimension] || 1;
  const label = DIMENSION_LABELS[dimension] || dimension;

  return (
    <div className="p-4 bg-void-300/40 border border-amber-400/20 rounded-xl animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-amber-300">{label}</span>
          {weight >= 2 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300/70 border border-amber-400/20">
              Weight: {weight}x
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-smoke-300 hover:text-cream-100 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        {opinions.map((op, i) => {
          const score = op.quality_scores[dimension] ?? 0;
          const cfg = getJudgeConfig(op.judge, i);
          const relatedIssue = op.top_issues?.find(
            (i) => i.dimension.toLowerCase().includes(dimension.replace('_', ' '))
          );

          return (
            <div key={op.judge} className="flex items-center gap-3">
              <span className={`text-xs w-16 ${cfg?.text}`}>{op.judge}</span>
              <div className="flex-1">
                <ScoreBar score={score} color={cfg?.color} height={8} showValue />
              </div>
              {relatedIssue && (
                <span className="text-[10px] text-smoke-200 max-w-[200px] truncate hidden sm:block">
                  {relatedIssue.fix}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VerificationSummaryBarProps {
  r1: DebateRound;
  r2: DebateRound | null;
  onViewDetails: () => void;
}

function VerificationSummaryBar({ r1, r2, onViewDetails }: VerificationSummaryBarProps) {
  const allReports = [
    ...Object.values(r1.opinions),
    ...(r2 ? Object.values(r2.opinions) : []),
  ]
    .filter((op) => op.fact_check_report?.claims && op.fact_check_report.claims.length > 0)
    .map((op) => ({ judge: op.judge, report: op.fact_check_report! }));

  if (allReports.length === 0) return null;

  const totalClaims = allReports.reduce((sum, r) => sum + r.report.summary.total, 0);
  const totalKb = allReports.reduce((sum, r) => sum + r.report.summary.verified_kb, 0);
  const totalWeb = allReports.reduce((sum, r) => sum + r.report.summary.verified_web, 0);
  const totalMismatches = allReports.reduce((sum, r) => sum + r.report.summary.mismatches, 0);

  return (
    <button
      onClick={onViewDetails}
      className="w-full p-4 rounded-xl border border-smoke-400/20 bg-void-300/30 hover:border-amber-400/25 hover:bg-void-300/40 transition-all text-left group"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <SourcePie kbCount={totalKb} webCount={totalWeb} unverifiedCount={totalClaims - totalKb - totalWeb} size={44} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-cream-100">Fact Verification</span>
            {totalMismatches > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-coral-500/15 text-coral-400 border border-coral-500/25">
                {totalMismatches} mismatch{totalMismatches > 1 ? 'es' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-[11px] text-smoke-200">
            <span>{totalClaims} claims</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> {totalKb} KB
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> {totalWeb} Web
            </span>
            {allReports.map((r, i) => (
              <span key={r.judge} className={`${getJudgeConfig(r.judge, i).text} opacity-60`}>
                {r.judge}: {r.report.summary.total}
              </span>
            ))}
          </div>
        </div>

        <svg className="w-5 h-5 text-smoke-300 group-hover:text-amber-300/60 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </button>
  );
}

interface FixesSummaryProps {
  round: DebateRound;
}

function FixesSummary({ round }: FixesSummaryProps) {
  if (round.consensus_fixes.length === 0 && round.priority_fixes.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {round.consensus_fixes.length > 0 && (
        <div className="p-4 bg-jade-500/5 border border-jade-500/15 rounded-xl">
          <p className="text-xs text-jade-300 font-medium mb-2 uppercase tracking-wider">
            Consensus Fixes ({round.consensus_fixes.length})
          </p>
          <ul className="space-y-1.5">
            {round.consensus_fixes.map((fix, i) => (
              <li key={i} className="text-xs text-cream-200 flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-jade-400 mt-1.5 flex-shrink-0" />
                {fix}
              </li>
            ))}
          </ul>
        </div>
      )}

      {round.priority_fixes.length > 0 && (
        <div className="p-4 bg-void-300/30 border border-smoke-400/20 rounded-xl">
          <p className="text-xs text-smoke-50 font-medium mb-2 uppercase tracking-wider">
            Priority Fixes ({round.priority_fixes.length})
          </p>
          <div className="space-y-1.5">
            {round.priority_fixes.map((fix, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/15 text-amber-300 flex items-center justify-center text-[10px] font-bold mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <span className="text-cream-200">{fix.fix}</span>
                  <span className="text-smoke-300 ml-1.5">P{fix.priority} / {fix.votes}v</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface BudgetBreakdownProps {
  budget: BudgetTracker;
}

function BudgetBreakdown({ budget }: BudgetBreakdownProps) {
  if (budget.calls.length === 0) return null;

  const maxCost = Math.max(...budget.calls.map((c) => c.cost));

  return (
    <div className="p-4 bg-void-300/20 border border-smoke-400/15 rounded-xl">
      <p className="text-xs text-smoke-50 font-medium mb-3 uppercase tracking-wider">Cost Breakdown</p>
      <div className="space-y-2">
        {budget.calls.map((call, i) => {
          const pct = maxCost > 0 ? (call.cost / maxCost) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-3 text-xs">
              <span className="text-smoke-100 w-40 truncate font-mono text-[11px]">{call.model}</span>
              <div className="flex-1 h-1.5 bg-void-300 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400/50"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-smoke-200 tabular-nums w-16 text-right">${call.cost.toFixed(4)}</span>
              <span className="text-smoke-300 tabular-nums w-20 text-right text-[10px]">
                {(call.tokens.input + call.tokens.output).toLocaleString()} tok
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
