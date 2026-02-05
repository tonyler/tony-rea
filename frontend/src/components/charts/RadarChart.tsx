import { useMemo } from 'react';
import type { QualityScores } from '../../features/articles/types';

interface RadarChartProps {
  datasets: Array<{
    label: string;
    scores: QualityScores;
    color: string;
    fillOpacity?: number;
  }>;
  size?: number;
  showLabels?: boolean;
  onDimensionClick?: (dimension: keyof QualityScores) => void;
  activeDimension?: keyof QualityScores | null;
}

const DIMENSIONS: (keyof QualityScores)[] = [
  'ai_slop', 'buzzword_density', 'human_voice', 'originality',
  'honesty_signals', 'emotional_authenticity', 'specificity',
  'jargon_accessibility', 'source_credibility', 'reader_respect',
];

const DIMENSION_LABELS: Record<string, string> = {
  ai_slop: 'AI Slop',
  buzzword_density: 'Buzzwords',
  human_voice: 'Human Voice',
  originality: 'Originality',
  honesty_signals: 'Honesty',
  emotional_authenticity: 'Emotion',
  specificity: 'Specificity',
  jargon_accessibility: 'Accessibility',
  source_credibility: 'Credibility',
  reader_respect: 'Respect',
};

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

export function RadarChart({
  datasets,
  size = 280,
  showLabels = true,
  onDimensionClick,
  activeDimension,
}: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const labelRadius = size * 0.46;
  const angleStep = (2 * Math.PI) / DIMENSIONS.length;
  const startAngle = -Math.PI / 2;

  const gridLines = useMemo(() => {
    const levels = [2, 4, 6, 8, 10];
    return levels.map((level) => {
      const points = DIMENSIONS.map((_, i) => {
        const angle = startAngle + i * angleStep;
        const r = (level / 10) * radius;
        const { x, y } = polarToCartesian(cx, cy, r, angle);
        return `${x},${y}`;
      }).join(' ');
      return { level, points };
    });
  }, [cx, cy, radius, angleStep]);

  const axisLines = useMemo(() => {
    return DIMENSIONS.map((_, i) => {
      const angle = startAngle + i * angleStep;
      const { x, y } = polarToCartesian(cx, cy, radius, angle);
      return { x1: cx, y1: cy, x2: x, y2: y };
    });
  }, [cx, cy, radius, angleStep]);

  const datasetPaths = useMemo(() => {
    return datasets.map((dataset) => {
      const points = DIMENSIONS.map((dim, i) => {
        const score = dataset.scores[dim] ?? 0;
        const angle = startAngle + i * angleStep;
        const r = (score / 10) * radius;
        return polarToCartesian(cx, cy, r, angle);
      });
      const pathData = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ') + ' Z';
      return { ...dataset, pathData, points };
    });
  }, [datasets, cx, cy, radius, angleStep]);

  const labelPositions = useMemo(() => {
    return DIMENSIONS.map((dim, i) => {
      const angle = startAngle + i * angleStep;
      const { x, y } = polarToCartesian(cx, cy, labelRadius, angle);
      const textAnchor: 'middle' | 'start' | 'end' = Math.abs(x - cx) < 2 ? 'middle' : x > cx ? 'start' : 'end';
      const dy = Math.abs(y - cy) < 2 ? '0.35em' : y > cy ? '0.8em' : '-0.3em';
      return { dim, x, y, textAnchor, dy };
    });
  }, [cx, cy, labelRadius, angleStep]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="select-none"
    >
      {/* Grid polygons */}
      {gridLines.map(({ level, points }) => (
        <polygon
          key={level}
          points={points}
          fill="none"
          stroke="rgba(142,142,153,0.12)"
          strokeWidth={level === 10 ? 1 : 0.5}
        />
      ))}

      {/* Axis lines */}
      {axisLines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="rgba(142,142,153,0.08)"
          strokeWidth={0.5}
        />
      ))}

      {/* Data fills */}
      {datasetPaths.map((d) => (
        <path
          key={`fill-${d.label}`}
          d={d.pathData}
          fill={d.color}
          fillOpacity={d.fillOpacity ?? 0.12}
          stroke="none"
        />
      ))}

      {/* Data strokes */}
      {datasetPaths.map((d) => (
        <path
          key={`stroke-${d.label}`}
          d={d.pathData}
          fill="none"
          stroke={d.color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ))}

      {/* Data points */}
      {datasetPaths.map((d) =>
        d.points.map((p, i) => (
          <circle
            key={`${d.label}-${i}`}
            cx={p.x}
            cy={p.y}
            r={activeDimension === DIMENSIONS[i] ? 4 : 2.5}
            fill={d.color}
            stroke="rgba(12,12,13,0.8)"
            strokeWidth={1}
            className={onDimensionClick ? 'cursor-pointer' : ''}
            onClick={() => onDimensionClick?.(DIMENSIONS[i])}
          />
        ))
      )}

      {/* Labels */}
      {showLabels && labelPositions.map(({ dim, x, y, textAnchor, dy }) => (
        <text
          key={dim}
          x={x}
          y={y}
          textAnchor={textAnchor}
          dy={dy}
          className={`text-[9px] ${
            activeDimension === dim ? 'fill-amber-300' : 'fill-smoke-100'
          } ${onDimensionClick ? 'cursor-pointer hover:fill-amber-200' : ''}`}
          style={{ fontFamily: 'Satoshi, system-ui, sans-serif' }}
          onClick={() => onDimensionClick?.(dim as keyof QualityScores)}
        >
          {DIMENSION_LABELS[dim] || dim}
        </text>
      ))}
    </svg>
  );
}

export { DIMENSIONS, DIMENSION_LABELS };
