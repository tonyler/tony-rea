import type { LLMConfig, ModelId, JudgeRole, SearchMode, CouncilMode, JudgeSelection } from '../features/articles/types';

interface LLMConfigPanelProps {
  config: LLMConfig;
  onChange: (config: LLMConfig) => void;
}

const MODEL_OPTIONS: { value: ModelId; label: string }[] = [
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-5.1', label: 'GPT-5.1' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-3-flash', label: 'Gemini 3 Flash' },
  { value: 'gemini-3-pro', label: 'Gemini 3 Pro' },
  { value: 'grok-4-1-fast', label: 'Grok 4.1 Fast' },
  { value: 'grok-4-1-fast-x', label: 'Grok 4.1 + X Search' },
];

const ROLE_OPTIONS: { value: JudgeRole; label: string }[] = [
  { value: 'fact-checker', label: 'Fact Checker' },
  { value: 'slop-detector', label: 'Slop Detector' },
  { value: 'originality-reviewer', label: 'Originality' },
  { value: 'rules-enforcer', label: 'Rules Enforcer' },
];

const SEARCH_MODE_OPTIONS: { value: SearchMode; label: string }[] = [
  { value: 'full', label: 'Full (Web + X)' },
  { value: 'web-only', label: 'Web Only' },
  { value: 'x-only', label: 'X Only' },
  { value: 'none', label: 'None' },
];

const MODEL_CAPABILITIES: Record<ModelId, { webSearch: boolean; xSearch: boolean }> = {
  'claude-sonnet-4-5': { webSearch: false, xSearch: false },
  'claude-haiku-4-5': { webSearch: true, xSearch: false },
  'claude-opus-4-5': { webSearch: true, xSearch: false },
  'gpt-5.2': { webSearch: true, xSearch: false },
  'gpt-5.1': { webSearch: true, xSearch: false },
  'gpt-5-mini': { webSearch: true, xSearch: false },
  'gemini-2.5-flash': { webSearch: true, xSearch: false },
  'gemini-2.5-pro': { webSearch: true, xSearch: false },
  'gemini-3-flash': { webSearch: true, xSearch: false },
  'gemini-3-pro': { webSearch: true, xSearch: false },
  'grok-4-1-fast': { webSearch: true, xSearch: false },
  'grok-4-1-fast-x': { webSearch: false, xSearch: true },
};

const MODEL_DRAFT_COST: Record<ModelId, number> = {
  'claude-sonnet-4-5': 0.04,
  'claude-haiku-4-5': 0.015,
  'claude-opus-4-5': 0.08,
  'gpt-5.2': 0.04,
  'gpt-5.1': 0.03,
  'gpt-5-mini': 0.006,
  'gemini-2.5-flash': 0.008,
  'gemini-2.5-pro': 0.03,
  'gemini-3-flash': 0.01,
  'gemini-3-pro': 0.045,
  'grok-4-1-fast': 0.003,
  'grok-4-1-fast-x': 0.003,
};

function getWarnings(config: LLMConfig): string[] {
  const warnings: string[] = [];
  for (const judge of config.judges) {
    const caps = MODEL_CAPABILITIES[judge.model];
    if (judge.role === 'fact-checker' && !caps.webSearch && config.searchMode !== 'none' && (config.searchMode === 'full' || config.searchMode === 'web-only')) {
      warnings.push(`${judge.model}: web search unavailable`);
    }
    if (judge.role === 'slop-detector' && !caps.xSearch && config.searchMode !== 'none' && (config.searchMode === 'full' || config.searchMode === 'x-only')) {
      warnings.push(`${judge.model}: X search unavailable`);
    }
  }
  return warnings;
}

export function estimateCost(config: LLMConfig): number {
  const draftCost = MODEL_DRAFT_COST[config.draftModel] || 0.04;
  const revisionCost = config.councilMode === 'skip' ? 0 : (MODEL_DRAFT_COST[config.revisionModel] || 0.04);
  const judgeCost = config.councilMode === 'skip' ? 0 : config.judges.length * 0.01;
  return draftCost + judgeCost + revisionCost;
}

export function LLMConfigPanel({ config, onChange }: LLMConfigPanelProps) {
  const warnings = getWarnings(config);
  const cost = estimateCost(config);

  const updateField = <K extends keyof LLMConfig>(key: K, value: LLMConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const updateJudge = (index: number, field: keyof JudgeSelection, value: string) => {
    const newJudges = config.judges.map((j, i) =>
      i === index ? { ...j, [field]: value } : j
    );
    onChange({ ...config, judges: newJudges });
  };

  const addJudge = () => {
    if (config.judges.length >= 4) return;
    onChange({
      ...config,
      judges: [...config.judges, { model: 'gpt-5-mini' as ModelId, role: 'fact-checker' as JudgeRole }],
    });
  };

  const removeJudge = (index: number) => {
    onChange({
      ...config,
      judges: config.judges.filter((_, i) => i !== index),
    });
  };

  const selectClass = 'bg-void-300/60 border border-smoke-400/25 rounded-lg px-3 py-1.5 text-sm text-cream-100 focus:border-amber-400/40 focus:outline-none appearance-none cursor-pointer';

  return (
    <div className="mt-3 p-4 bg-void-300/30 border border-smoke-400/20 rounded-xl space-y-4 animate-fade-in">
      {/* Row 1: Search Mode + Council Mode */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] text-smoke-200 mb-1.5 uppercase tracking-wider">Search Mode</label>
          <select
            value={config.searchMode}
            onChange={(e) => updateField('searchMode', e.target.value as SearchMode)}
            className={selectClass}
          >
            {SEARCH_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-smoke-200 mb-1.5 uppercase tracking-wider">Council</label>
          <select
            value={config.councilMode}
            onChange={(e) => updateField('councilMode', e.target.value as CouncilMode)}
            className={selectClass}
          >
            <option value="standard">Standard</option>
            <option value="skip">Skip</option>
          </select>
        </div>
      </div>

      {/* Row 2: Draft + Revision Models */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] text-smoke-200 mb-1.5 uppercase tracking-wider">Draft Model</label>
          <select
            value={config.draftModel}
            onChange={(e) => updateField('draftModel', e.target.value as ModelId)}
            className={selectClass}
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-smoke-200 mb-1.5 uppercase tracking-wider">Revision Model</label>
          <select
            value={config.revisionModel}
            onChange={(e) => updateField('revisionModel', e.target.value as ModelId)}
            className={selectClass}
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Judges */}
      {config.councilMode !== 'skip' && (
        <div>
          <label className="block text-[11px] text-smoke-200 mb-2 uppercase tracking-wider">
            Judges ({config.judges.length})
          </label>
          <div className="space-y-2">
            {config.judges.map((judge, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={judge.model}
                  onChange={(e) => updateJudge(i, 'model', e.target.value)}
                  className={`${selectClass} flex-1`}
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={judge.role}
                  onChange={(e) => updateJudge(i, 'role', e.target.value)}
                  className={`${selectClass} flex-1`}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeJudge(i)}
                  className="text-smoke-300 hover:text-coral-400 transition-colors p-1"
                  title="Remove judge"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {config.judges.length < 4 && (
            <button
              onClick={addJudge}
              className="mt-2 text-xs text-amber-300/70 hover:text-amber-300 transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Judge
            </button>
          )}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px] text-honey-400">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Cost Estimate */}
      <div className="text-[11px] text-smoke-200 pt-1 border-t border-smoke-400/15">
        Estimated cost: ~${cost.toFixed(3)}
      </div>
    </div>
  );
}
