import Button from './Button';

interface ArticleChatProps {
  instruction: string;
  onInstructionChange: (value: string) => void;
  onQuickEdit: () => void;
  onReCouncil: () => void;
  revising: boolean;
  disabled?: boolean;
}

export function ArticleChat({
  instruction,
  onInstructionChange,
  onQuickEdit,
  onReCouncil,
  revising,
  disabled,
}: ArticleChatProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">
          Request Changes
        </label>
        <textarea
          value={instruction}
          onChange={(e) => onInstructionChange(e.target.value)}
          placeholder="Describe what you'd like to change..."
          className="textarea"
          rows={3}
          disabled={revising || disabled}
        />
      </div>

      <div className="flex gap-3">
        <Button
          onClick={onQuickEdit}
          disabled={!instruction.trim() || revising || disabled}
          variant="secondary"
        >
          {revising ? 'Revising...' : 'Quick Edit (~$0.02)'}
        </Button>
        <Button
          onClick={onReCouncil}
          disabled={!instruction.trim() || revising || disabled}
        >
          {revising ? 'Re-evaluating...' : 'Re-Council (~$0.05)'}
        </Button>
      </div>

      <p className="text-xs text-smoke-200">
        <strong>Quick Edit:</strong> Fast revision preserving existing debate scores.{' '}
        <strong>Re-Council:</strong> Full regeneration with new judge evaluations.
      </p>
    </div>
  );
}
