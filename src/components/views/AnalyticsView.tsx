import React, { useMemo, useState } from 'react';
import type { DetectionSessionRecord, WorkspaceSection } from '../../types/vision';
import { formatDuration, formatPercent, getLocalDateKey } from '../../utils/formatters';
import { ActivityChart, type ActivityDayPoint } from '../charts/ActivityChart';
import { SectionHeader, StatCard } from '../ui/Primitives';

interface AnalyticsViewProps {
  sessions: DetectionSessionRecord[];
  onNavigate: (section: WorkspaceSection) => void;
}

export function AnalyticsView({ sessions, onNavigate }: AnalyticsViewProps) {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14);
  const [metric, setMetric] = useState<'faces' | 'sessions'>('faces');

  const analytics = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * dayMs;
    const fourteenDaysAgo = now - 14 * dayMs;

    const thisWeek = sessions.filter(
      (s) => new Date(s.timestamp).getTime() >= sevenDaysAgo,
    );
    const prevWeek = sessions.filter((s) => {
      const t = new Date(s.timestamp).getTime();
      return t >= fourteenDaysAgo && t < sevenDaysAgo;
    });

    const thisWeekFaces = thisWeek.reduce((a, b) => a + b.faceCount, 0);
    const prevWeekFaces = prevWeek.reduce((a, b) => a + b.faceCount, 0);

    const totalFaces = sessions.reduce((a, b) => a + b.faceCount, 0);
    const avgFacesPerSession = sessions.length > 0 ? totalFaces / sessions.length : 0;
    const peakSingleSession = sessions.reduce((max, s) => Math.max(max, s.faceCount), 0);
    const totalDuration = sessions.reduce((a, b) => a + b.durationMs, 0);

    const liveSessions = sessions.filter((s) => s.type === 'live').length;
    const imageSessions = sessions.filter((s) => s.type === 'image').length;

    const tinyCount = sessions.filter((s) => s.modelUsed === 'tiny').length;
    const ssdCount = sessions.filter((s) => s.modelUsed === 'ssd').length;

    // Confidence distribution across sessions with faces
    const buckets = [
      { label: '95% – 100%', count: 0 },
      { label: '85% – 94.9%', count: 0 },
      { label: '70% – 84.9%', count: 0 },
      { label: 'Below 70%', count: 0 },
    ];
    for (const s of sessions) {
      if (s.faceCount === 0) continue;
      const pct = s.avgConfidence * 100;
      if (pct >= 95) buckets[0].count += 1;
      else if (pct >= 85) buckets[1].count += 1;
      else if (pct >= 70) buckets[2].count += 1;
      else buckets[3].count += 1;
    }

    const bucketTotal = buckets.reduce((a, b) => a + b.count, 0);

    return {
      thisWeekFaces,
      prevWeekFaces,
      thisWeekSessions: thisWeek.length,
      totalFaces,
      avgFacesPerSession,
      peakSingleSession,
      totalDuration,
      liveSessions,
      imageSessions,
      tinyCount,
      ssdCount,
      buckets,
      bucketTotal,
    };
  }, [sessions]);

  const chartData = useMemo<ActivityDayPoint[]>(() => {
    const now = new Date();
    const map = new Map<
      string,
      { faces: number; sessions: number; confSum: number; confCount: number }
    >();

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      map.set(getLocalDateKey(d), {
        faces: 0,
        sessions: 0,
        confSum: 0,
        confCount: 0,
      });
    }

    for (const s of sessions) {
      const key = getLocalDateKey(s.timestamp);
      const entry = map.get(key);
      if (entry) {
        entry.faces += s.faceCount;
        entry.sessions += 1;
        if (s.faceCount > 0) {
          entry.confSum += s.avgConfidence;
          entry.confCount += 1;
        }
      }
    }

    return Array.from(map.entries()).map(([dateKey, agg]) => ({
      dateKey,
      label: new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      faces: agg.faces,
      sessions: agg.sessions,
      avgConfidence: agg.confCount > 0 ? agg.confSum / agg.confCount : 0,
    }));
  }, [sessions, rangeDays]);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Detection Analytics"
        description="Daily and weekly statistics, confidence score distributions, and session performance indicators computed from your local detection records."
      />

      {/* Weekly & Performance KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="7-Day Faces Detected"
          value={analytics.thisWeekFaces}
          detail={`Previous 7 days: ${analytics.prevWeekFaces}`}
          highlight={analytics.thisWeekFaces > 0}
        />
        <StatCard
          label="7-Day Sessions"
          value={analytics.thisWeekSessions}
          detail={`All-time total: ${sessions.length}`}
        />
        <StatCard
          label="Avg Faces / Session"
          value={sessions.length > 0 ? analytics.avgFacesPerSession.toFixed(1) : '—'}
          detail={`Peak faces in 1 session: ${analytics.peakSingleSession}`}
        />
        <StatCard
          label="Total Inference Runtime"
          value={sessions.length > 0 ? formatDuration(analytics.totalDuration) : '—'}
          detail={`${analytics.liveSessions} live · ${analytics.imageSessions} image`}
        />
      </div>

      {/* Main Chart */}
      <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
        <div className="flex flex-col gap-4 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100">
              Daily Detection Volume
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Chronological breakdown of recorded detections and sessions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-800 bg-[#080E1A] p-0.5">
              {(['faces', 'sessions'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetric(m)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    metric === m
                      ? 'bg-[#17243F] text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m === 'faces' ? 'Faces Detected' : 'Sessions'}
                </button>
              ))}
            </div>

            <div className="flex items-center rounded-lg border border-slate-800 bg-[#080E1A] p-0.5">
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setRangeDays(d)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    rangeDays === d
                      ? 'bg-[#17243F] text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-[#080E1A]/60 px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-200">
                No analytics data recorded yet
              </p>
              <p className="mt-1 max-w-md text-xs text-slate-400">
                Run an image analysis or live camera detection to generate real charts and
                confidence breakdowns.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('image')}
                className="mt-5 min-h-[40px] rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 cursor-pointer"
              >
                Run First Image Analysis
              </button>
            </div>
          ) : (
            <ActivityChart data={chartData} metric={metric} height={260} />
          )}
        </div>
      </div>

      {/* Confidence Distribution & Model Summaries */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
          <h3 className="font-display text-base font-semibold text-slate-100">
            Confidence Score Distribution
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Session average confidence distribution across scans with detected faces
          </p>

          <div className="mt-5 space-y-4">
            {analytics.buckets.map((bucket) => {
              const pct =
                analytics.bucketTotal > 0 ? (bucket.count / analytics.bucketTotal) * 100 : 0;
              return (
                <div key={bucket.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{bucket.label}</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {bucket.count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-cyan-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
          <h3 className="font-display text-base font-semibold text-slate-100">
            Session Summary & Model Breakdown
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Execution split across neural detector architectures and capture modes
          </p>

          <div className="mt-5 divide-y divide-slate-800/80 border-t border-b border-slate-800/80 text-xs">
            <div className="flex items-center justify-between py-3">
              <span className="text-slate-300">Live Camera Sessions</span>
              <span className="font-mono font-semibold text-slate-100 tabular-nums">
                {analytics.liveSessions}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-slate-300">Still Image Analysis Sessions</span>
              <span className="font-mono font-semibold text-slate-100 tabular-nums">
                {analytics.imageSessions}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-slate-300">TinyFaceDetector Runs</span>
              <span className="font-mono font-semibold text-cyan-400 tabular-nums">
                {analytics.tinyCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-slate-300">SSD MobileNet v1 Runs</span>
              <span className="font-mono font-semibold text-cyan-400 tabular-nums">
                {analytics.ssdCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-slate-300">Highest Single-Session Confidence</span>
              <span className="font-mono font-semibold text-slate-100 tabular-nums">
                {sessions.some((s) => s.maxConfidence > 0)
                  ? formatPercent(Math.max(...sessions.map((s) => s.maxConfidence)))
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
