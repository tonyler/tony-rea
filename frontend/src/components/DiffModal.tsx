import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDraft: { title: string; content: string };
  finalArticle: { title: string; content: string };
}

type DiffSegment = {
  type: 'equal' | 'removed' | 'added';
  text: string;
};

function computeLCS(a: string[], b: string[]): boolean[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const inLCS: boolean[][] = [Array(m).fill(false), Array(n).fill(false)];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      inLCS[0][i - 1] = true;
      inLCS[1][j - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return inLCS;
}

function diffWords(oldText: string, newText: string): DiffSegment[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  const [oldInLCS, newInLCS] = computeLCS(oldWords, newWords);

  const segments: DiffSegment[] = [];
  let oi = 0;
  let ni = 0;

  while (oi < oldWords.length || ni < newWords.length) {
    if (oi < oldWords.length && !oldInLCS[oi]) {
      const buf: string[] = [];
      while (oi < oldWords.length && !oldInLCS[oi]) {
        buf.push(oldWords[oi++]);
      }
      segments.push({ type: 'removed', text: buf.join('') });
    }
    if (ni < newWords.length && !newInLCS[ni]) {
      const buf: string[] = [];
      while (ni < newWords.length && !newInLCS[ni]) {
        buf.push(newWords[ni++]);
      }
      segments.push({ type: 'added', text: buf.join('') });
    }
    if (oi < oldWords.length && ni < newWords.length && oldInLCS[oi] && newInLCS[ni]) {
      const buf: string[] = [];
      while (oi < oldWords.length && ni < newWords.length && oldInLCS[oi] && newInLCS[ni]) {
        buf.push(oldWords[oi++]);
        ni++;
      }
      segments.push({ type: 'equal', text: buf.join('') });
    }
  }

  return segments;
}

function DiffParagraph({ oldText, newText }: { oldText: string; newText: string }) {
  const segments = useMemo(() => diffWords(oldText, newText), [oldText, newText]);

  return (
    <p className="text-sm leading-relaxed mb-3">
      {segments.map((seg, i) => {
        if (seg.type === 'removed') {
          return (
            <span key={i} className="bg-coral-500/20 text-coral-300 line-through decoration-coral-400/60">
              {seg.text}
            </span>
          );
        }
        if (seg.type === 'added') {
          return (
            <span key={i} className="bg-jade-500/20 text-jade-300">
              {seg.text}
            </span>
          );
        }
        return <span key={i} className="text-cream-200">{seg.text}</span>;
      })}
    </p>
  );
}

function diffParagraphs(oldContent: string, newContent: string): { oldPara: string; newPara: string }[] {
  const oldParas = oldContent.split(/\n\n+/).filter(Boolean);
  const newParas = newContent.split(/\n\n+/).filter(Boolean);

  const [oldInLCS, newInLCS] = computeLCS(oldParas, newParas);

  const result: { oldPara: string; newPara: string }[] = [];
  let oi = 0;
  let ni = 0;

  while (oi < oldParas.length || ni < newParas.length) {
    if (oi < oldParas.length && !oldInLCS[oi]) {
      while (oi < oldParas.length && !oldInLCS[oi]) {
        if (ni < newParas.length && !newInLCS[ni]) {
          result.push({ oldPara: oldParas[oi], newPara: newParas[ni] });
          oi++;
          ni++;
        } else {
          result.push({ oldPara: oldParas[oi], newPara: '' });
          oi++;
        }
      }
    }
    if (ni < newParas.length && !newInLCS[ni]) {
      while (ni < newParas.length && !newInLCS[ni]) {
        result.push({ oldPara: '', newPara: newParas[ni] });
        ni++;
      }
    }
    if (oi < oldParas.length && ni < newParas.length && oldInLCS[oi] && newInLCS[ni]) {
      result.push({ oldPara: oldParas[oi], newPara: newParas[ni] });
      oi++;
      ni++;
    }
  }

  return result;
}

export function DiffModal({ isOpen, onClose, initialDraft, finalArticle }: DiffModalProps) {
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

  const paragraphPairs = useMemo(
    () => diffParagraphs(initialDraft.content, finalArticle.content),
    [initialDraft.content, finalArticle.content]
  );

  const titleChanged = initialDraft.title !== finalArticle.title;

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-void-500/95 backdrop-blur-md"
        onClick={onClose}
        style={{
          background: 'radial-gradient(ellipse at center, rgba(15, 15, 18, 0.95) 0%, rgba(10, 10, 12, 0.98) 100%)',
        }}
      />

      <div
        className="relative bg-void-400/95 border border-smoke-400/30 rounded-2xl w-full max-w-6xl max-h-[85vh] overflow-hidden shadow-elevated animate-fade-in flex flex-col"
        style={{
          boxShadow: `
            0 0 0 1px rgba(255, 255, 255, 0.03),
            0 25px 50px -12px rgba(0, 0, 0, 0.6),
            0 0 80px -20px rgba(139, 92, 246, 0.15)
          `,
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-smoke-400/20 bg-void-400/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400/20 to-violet-500/10 border border-violet-400/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-cream-50">Article Changes</h2>
                <p className="text-xs text-smoke-200 mt-0.5">Initial draft vs final article after council revision</p>
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

          {titleChanged && (
            <div className="mt-4 p-3 rounded-lg bg-void-300/40 border border-smoke-400/20">
              <div className="text-[10px] uppercase tracking-wider text-smoke-300 mb-2 font-medium">Title Changed</div>
              <div className="flex gap-4 text-sm">
                <div className="flex-1">
                  <span className="bg-coral-500/20 text-coral-300 line-through decoration-coral-400/60 px-1 rounded">
                    {initialDraft.title}
                  </span>
                </div>
                <div className="flex-1">
                  <span className="bg-jade-500/20 text-jade-300 px-1 rounded">
                    {finalArticle.title}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="font-mono text-[13px] space-y-4">
            {paragraphPairs.map((pair, i) => {
              if (pair.oldPara === pair.newPara) {
                return (
                  <p key={i} className="text-cream-200 leading-relaxed mb-3">
                    {pair.oldPara}
                  </p>
                );
              }
              if (!pair.oldPara) {
                return (
                  <p key={i} className="text-sm leading-relaxed mb-3">
                    <span className="bg-jade-500/20 text-jade-300">{pair.newPara}</span>
                  </p>
                );
              }
              if (!pair.newPara) {
                return (
                  <p key={i} className="text-sm leading-relaxed mb-3">
                    <span className="bg-coral-500/20 text-coral-300 line-through decoration-coral-400/60">{pair.oldPara}</span>
                  </p>
                );
              }
              return <DiffParagraph key={i} oldText={pair.oldPara} newText={pair.newPara} />;
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-smoke-400/20 bg-void-400/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-smoke-200">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-coral-500/30 border border-coral-500/40" />
                Removed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-jade-500/30 border border-jade-500/40" />
                Added
              </span>
            </div>
            <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
