interface ScoreBarProps {
  score: number;
  max?: number;
  color?: string;
  height?: number;
  showValue?: boolean;
  label?: string;
  animated?: boolean;
}

function getDefaultColor(score: number): string {
  if (score >= 9) return '#4ade80';
  if (score >= 7) return '#fbbf24';
  if (score >= 5) return '#f97316';
  return '#f87171';
}

export function ScoreBar({
  score,
  max = 10,
  color,
  height = 6,
  showValue = false,
  label,
  animated = true,
}: ScoreBarProps) {
  const fillColor = color || getDefaultColor(score);
  const pct = Math.min((score / max) * 100, 100);

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-[11px] text-smoke-100 truncate">{label}</span>}
          {showValue && (
            <span className="text-[11px] font-medium ml-2 tabular-nums" style={{ color: fillColor }}>
              {score.toFixed(1)}
            </span>
          )}
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height, backgroundColor: 'rgba(58,58,64,0.4)' }}
      >
        <div
          className={`h-full rounded-full ${animated ? 'transition-all duration-700 ease-out' : ''}`}
          style={{
            width: `${pct}%`,
            backgroundColor: fillColor,
            boxShadow: `0 0 8px ${fillColor}40`,
          }}
        />
      </div>
    </div>
  );
}

interface MiniScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function MiniScoreRing({
  score,
  size = 36,
  strokeWidth = 3,
  color,
}: MiniScoreRingProps) {
  const fillColor = color || getDefaultColor(score);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 10) * circumference;
  const offset = circumference - progress;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(58,58,64,0.5)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          style={{ filter: `drop-shadow(0 0 4px ${fillColor}40)` }}
        />
      </svg>
      <span
        className="absolute text-[10px] font-bold tabular-nums"
        style={{ color: fillColor }}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}

interface SourcePieProps {
  kbCount: number;
  webCount: number;
  unverifiedCount: number;
  size?: number;
}

export function SourcePie({ kbCount, webCount, unverifiedCount, size = 48 }: SourcePieProps) {
  const total = kbCount + webCount + unverifiedCount;
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - 4) / 2;

  const segments = [
    { count: kbCount, color: '#a78bfa', label: 'KB' },
    { count: webCount, color: '#60a5fa', label: 'Web' },
    { count: unverifiedCount, color: '#6e6e78', label: 'N/A' },
  ].filter((s) => s.count > 0);

  let currentAngle = -90;
  const paths = segments.map((seg) => {
    const angle = (seg.count / total) * 360;
    const startRad = (currentAngle * Math.PI) / 180;
    const endRad = ((currentAngle + angle) * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const d = segments.length === 1
      ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    currentAngle += angle;
    return { ...seg, d };
  });

  return (
    <svg width={size} height={size} className="select-none">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} fillOpacity={0.7} stroke="rgba(12,12,13,0.6)" strokeWidth={1} />
      ))}
    </svg>
  );
}
