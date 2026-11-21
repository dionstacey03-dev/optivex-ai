import React, { useMemo, useState } from 'react';

export interface ActivityDayPoint {
  dateKey: string;
  label: string;
  faces: number;
  sessions: number;
  avgConfidence: number;
}

interface ActivityChartProps {
  data: ActivityDayPoint[];
  metric: 'faces' | 'sessions';
  height?: number;
}

export function ActivityChart({ data, metric, height = 240 }: ActivityChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = useMemo(() => {
    const rawMax = Math.max(...data.map((d) => (metric === 'faces' ? d.faces : d.sessions)), 0);
    return Math.max(4, Math.ceil(rawMax * 1.15));
  }, [data, metric]);

  const width = 760;
  const padLeft = 44;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const yTicks = [0, Math.round(maxVal * 0.33), Math.round(maxVal * 0.66), maxVal];

  const barStep = data.length > 0 ? plotW / data.length : plotW;
  const barWidth = Math.max(8, Math.min(34, barStep * 0.54));

  const hoveredPoint = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="relative w-full select-none">
      {hoveredPoint ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#111C33] px-3.5 py-2 text-xs">
          <span className="font-medium text-slate-200">{hoveredPoint.label}</span>
          <div className="flex items-center gap-4 font-mono tabular-nums text-slate-300">
            <span>
              Faces: <strong className="text-cyan-400">{hoveredPoint.faces}</strong>
            </span>
            <span>
              Sessions: <strong className="text-slate-100">{hoveredPoint.sessions}</strong>
            </span>
            <span>
              Avg Conf:{' '}
              <strong className="text-slate-100">
                {hoveredPoint.sessions > 0
                  ? `${(hoveredPoint.avgConfidence * 100).toFixed(1)}%`
                  : '—'}
              </strong>
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between px-1 text-xs text-slate-400">
          <span>Hover or tap any day bar to inspect detection metrics</span>
          <span className="font-mono tabular-nums text-slate-300">
            Peak: {Math.max(...data.map((d) => (metric === 'faces' ? d.faces : d.sessions)), 0)}
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        role="img"
        aria-label={`Daily ${metric === 'faces' ? 'faces detected' : 'detection sessions'} chart`}
      >
        {/* Horizontal grid lines */}
        {yTicks.map((tick, i) => {
          const y = padTop + plotH - (tick / maxVal) * plotH;
          return (
            <g key={`tick-${i}-${tick}`}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="rgba(148, 163, 184, 0.12)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={y + 4}
                textAnchor="end"
                fill="#94A3B8"
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((point, idx) => {
          const val = metric === 'faces' ? point.faces : point.sessions;
          const barH = Math.max(val > 0 ? 4 : 0, (val / maxVal) * plotH);
          const xCenter = padLeft + idx * barStep + barStep / 2;
          const x = xCenter - barWidth / 2;
          const y = padTop + plotH - barH;
          const isHovered = hoveredIdx === idx;
          const showLabel = data.length <= 14 || idx % Math.ceil(data.length / 10) === 0 || idx === data.length - 1;

          return (
            <g
              key={point.dateKey}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => setHoveredIdx(idx)}
              className="cursor-pointer"
            >
              {/* Invisible hit target */}
              <rect
                x={padLeft + idx * barStep}
                y={padTop}
                width={barStep}
                height={plotH}
                fill="transparent"
              />
              {/* Baseline track */}
              <rect
                x={x}
                y={padTop + plotH - 2}
                width={barWidth}
                height={2}
                rx={1}
                fill="rgba(148, 163, 184, 0.16)"
              />
              {/* Value bar */}
              {barH > 0 ? (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx={3}
                  fill={isHovered ? '#22D3EE' : '#0891B2'}
                />
              ) : null}

              {showLabel ? (
                <text
                  x={xCenter}
                  y={height - 10}
                  textAnchor="middle"
                  fill={isHovered ? '#F8FAFC' : '#94A3B8'}
                  fontSize="11"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
