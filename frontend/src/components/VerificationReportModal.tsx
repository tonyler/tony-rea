import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FactCheckReport, VerifiedClaim, DebateRound } from '../features/articles/types';

type FilterTab = 'all' | 'match' | 'mismatch' | 'unverified';

interface VerificationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  r1: DebateRound;
  r2: DebateRound | null;
}

const STATUS_CONFIG = {
  match: {
    icon: '✓',
    label: 'Verified',
    bg: 'bg-jade-500/15',
    border: 'border-jade-500/40',
    text: 'text-jade-400',
    iconBg: 'bg-jade-500/20',
  },
  mismatch: {
    icon: '✗',
    label: 'Mismatch',
    bg: 'bg-coral-500/15',
    border: 'border-coral-500/40',
    text: 'text-coral-400',
    iconBg: 'bg-coral-500/20',
  },
  unverified: {
    icon: '?',
    label: 'Unverified',
    bg: 'bg-honey-500/15',
    border: 'border-honey-500/40',
    text: 'text-honey-400',
    iconBg: 'bg-honey-500/20',
  },
};

const SOURCE_BADGES = {
  kb: { label: 'KB', bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' },
  web: { label: 'Web', bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  unverified: { label: 'N/A', bg: 'bg-smoke-400/20', text: 'text-smoke-200', border: 'border-smoke-400/30' },
};

function aggregateReports(r1: DebateRound, r2: DebateRound | null): FactCheckReport | null {
  const allClaims: VerifiedClaim[] = [];
  const seenClaims = new Set<string>();

  const processRound = (round: DebateRound) => {
    Object.values(round.opinions).forEach((opinion) => {
      if (opinion.fact_check_report?.claims) {
        opinion.fact_check_report.claims.forEach((claim) => {
          const key = `${claim.claim}|${claim.article_value}`;
          if (!seenClaims.has(key)) {
            seenClaims.add(key);
            allClaims.push(claim);
          }
        });
      }
    });
  };

  processRound(r1);
  if (r2) processRound(r2);

  if (allClaims.length === 0) return null;

  const verifiedKb = allClaims.filter((c) => c.source_type === 'kb' && c.status === 'match').length;
  const verifiedWeb = allClaims.filter((c) => c.source_type === 'web' && c.status === 'match').length;
  const mismatches = allClaims.filter((c) => c.status === 'mismatch').length;
  // Count both explicit 'unverified' and any unexpected status values
  const unverified = allClaims.length - verifiedKb - verifiedWeb - mismatches;

  return {
    claims: allClaims,
    summary: {
      total: allClaims.length,
      verified_kb: verifiedKb,
      verified_web: verifiedWeb,
      mismatches,
      unverified,
    },
  };
}

export function VerificationReportModal({ isOpen, onClose, r1, r2 }: VerificationReportModalProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const report = aggregateReports(r1, r2);

  if (!report) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-void-500/90 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-void-400 border border-smoke-400/40 rounded-2xl p-8 max-w-md w-full shadow-elevated animate-fade-in">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-smoke-400/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-smoke-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-display font-semibold text-cream-50 mb-2">No Verification Data</h3>
            <p className="text-sm text-smoke-100 mb-6">
              This article was generated without fact-check verification enabled, or the council did not produce verification reports.
            </p>
            <button onClick={onClose} className="btn-secondary">Close</button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const filteredClaims = report.claims.filter((claim) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unverified') {
      // Include both explicit 'unverified' and any unexpected status values
      return claim.status !== 'match' && claim.status !== 'mismatch';
    }
    return claim.status === activeTab;
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All Claims', count: report.summary.total },
    { key: 'match', label: 'Verified', count: report.summary.verified_kb + report.summary.verified_web },
    { key: 'mismatch', label: 'Mismatches', count: report.summary.mismatches },
    { key: 'unverified', label: 'Unverified', count: report.summary.unverified },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-void-500/95 backdrop-blur-md"
        onClick={onClose}
        style={{
          background: 'radial-gradient(ellipse at center, rgba(15, 15, 18, 0.95) 0%, rgba(10, 10, 12, 0.98) 100%)',
        }}
      />

      {/* Modal */}
      <div
        className="relative bg-void-400/95 border border-smoke-400/30 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-elevated animate-fade-in flex flex-col"
        style={{
          boxShadow: `
            0 0 0 1px rgba(255, 255, 255, 0.03),
            0 25px 50px -12px rgba(0, 0, 0, 0.6),
            0 0 80px -20px rgba(249, 216, 115, 0.15)
          `,
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-smoke-400/20 bg-void-400/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-500/10 border border-amber-400/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-cream-50">Fact Verification Report</h2>
                <p className="text-xs text-smoke-200 mt-0.5">Bullet-by-bullet claim verification</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-void-300/60 border border-smoke-400/30 flex items-center justify-center text-smoke-100 hover:text-cream-50 hover:bg-void-200 hover:border-smoke-300/50 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3 mt-5">
            <div className="px-3 py-2.5 rounded-lg bg-void-300/40 border border-smoke-400/20">
              <div className="text-xl font-display font-bold text-cream-50">{report.summary.total}</div>
              <div className="text-xs text-smoke-200 mt-0.5">Total Claims</div>
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-jade-500/10 border border-jade-500/20">
              <div className="text-xl font-display font-bold text-jade-400">
                {report.summary.verified_kb + report.summary.verified_web}
              </div>
              <div className="text-xs text-jade-300/70 mt-0.5">
                Verified ({report.summary.verified_kb} KB / {report.summary.verified_web} Web)
              </div>
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-coral-500/10 border border-coral-500/20">
              <div className="text-xl font-display font-bold text-coral-400">{report.summary.mismatches}</div>
              <div className="text-xs text-coral-300/70 mt-0.5">Mismatches</div>
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-honey-500/10 border border-honey-500/20">
              <div className="text-xl font-display font-bold text-honey-400">{report.summary.unverified}</div>
              <div className="text-xs text-honey-300/70 mt-0.5">Unverified</div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 mt-5 p-1 bg-void-300/30 rounded-lg border border-smoke-400/20">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                    : 'text-smoke-100 hover:text-cream-100 hover:bg-void-200/50 border border-transparent'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === tab.key ? 'bg-amber-400/20' : 'bg-smoke-400/30'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Claims List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredClaims.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-smoke-400/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-smoke-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-sm text-smoke-100">No claims in this category</p>
            </div>
          ) : (
            filteredClaims.map((claim, index) => (
              <ClaimCard key={index} claim={claim} index={index + 1} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-smoke-400/20 bg-void-400/50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-smoke-200">
              Verification powered by Council judges with KB + Web search
            </p>
            <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">
              Close Report
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ClaimCardProps {
  claim: VerifiedClaim;
  index: number;
}

function ClaimCard({ claim, index }: ClaimCardProps) {
  // Normalize status and source_type to handle unexpected values from backend
  const normalizedStatus = (['match', 'mismatch', 'unverified'] as const).includes(claim.status as any)
    ? claim.status as 'match' | 'mismatch' | 'unverified'
    : 'unverified';
  const normalizedSourceType = (['kb', 'web', 'unverified'] as const).includes(claim.source_type as any)
    ? claim.source_type as 'kb' | 'web' | 'unverified'
    : 'unverified';

  const config = STATUS_CONFIG[normalizedStatus];
  const sourceConfig = SOURCE_BADGES[normalizedSourceType];

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden transition-all hover:border-opacity-60`}>
      <div className="px-4 py-3">
        {/* Header Row */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${config.iconBg} flex items-center justify-center`}>
            <span className={`text-sm font-bold ${config.text}`}>{config.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-smoke-300">Claim #{index}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.text} border ${config.border}`}>
                {config.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${sourceConfig.bg} ${sourceConfig.text} border ${sourceConfig.border}`}>
                {sourceConfig.label}
              </span>
            </div>
            <p className="text-sm text-cream-100 mt-1 font-medium">{claim.claim}</p>
          </div>
        </div>

        {/* Comparison */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="p-3 rounded-lg bg-void-300/40 border border-smoke-400/20">
            <div className="text-[10px] uppercase tracking-wider text-smoke-300 mb-1.5 font-medium">Article States</div>
            <p className="text-xs text-cream-200 leading-relaxed">{claim.article_value || '—'}</p>
          </div>
          <div className={`p-3 rounded-lg ${claim.status === 'match' ? 'bg-jade-500/10 border-jade-500/20' : claim.status === 'mismatch' ? 'bg-coral-500/10 border-coral-500/20' : 'bg-smoke-400/10 border-smoke-400/20'} border`}>
            <div className="text-[10px] uppercase tracking-wider text-smoke-300 mb-1.5 font-medium">Verified Value</div>
            <p className="text-xs text-cream-200 leading-relaxed">{claim.verified_value || '—'}</p>
          </div>
        </div>

        {/* Source Attribution */}
        {(claim.source_id || claim.source_url) && (
          <div className="mt-3 pt-3 border-t border-smoke-400/15">
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-smoke-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              {claim.source_type === 'kb' && claim.source_id && (
                <span className="text-violet-300">KB Entry: {claim.source_id}</span>
              )}
              {claim.source_type === 'web' && claim.source_url && (
                <a
                  href={claim.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 hover:text-blue-200 underline underline-offset-2 decoration-blue-400/40 hover:decoration-blue-300 transition-colors truncate max-w-[300px]"
                >
                  {claim.source_url}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
