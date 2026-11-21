import React, { useMemo, useState } from 'react';
import { ArrowRight, Camera, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import type {
  AuthorizedProfile,
  DetectionSessionRecord,
  VisionSettings,
  WorkspaceSection,
} from '../../types/vision';
import { formatPercent, formatTimestamp, getLocalDateKey } from '../../utils/formatters';
import { ActivityChart, type ActivityDayPoint } from '../charts/ActivityChart';
import { SectionHeader, StatCard } from '../ui/Primitives';

interface DashboardViewProps {
  sessions: DetectionSessionRecord[];
  profiles: AuthorizedProfile[];
  settings: VisionSettings;
  onNavigate: (section: WorkspaceSection) => void;
}

export function DashboardView({
  sessions,
  profiles,
  settings,
  onNavigate,
}: DashboardViewProps) {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(7);
  const [chartMetric, setChartMetric] = useState<'faces' | 'sessions'>('faces');

  const stats = useMemo(() => {
    const totalFaces = sessions.reduce((acc, s) => acc + s.faceCount, 0);
    const liveCount = sessions.filter((s) => s.type === 'live').length;
    const imageCount = sessions.filter((s) => s.type === 'image').length;
    const sessionsWithFaces = sessions.filter((s) => s.faceCount > 0 && s.avgConfidence > 0);
    const meanConfidence =
      sessionsWithFaces.length > 0
        ? sessionsWithFaces.reduce((acc, s) => acc + s.avgConfidence, 0) /
          sessionsWithFaces.length
        : null;

    return {
      totalFaces,
      totalSessions: sessions.length,
      liveCount,
      imageCount,
      meanConfidence,
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
      const key = getLocalDateKey(d);
      map.set(key, { faces: 0, sessions: 0, confSum: 0, confCount: 0 });
    }

    for (const s of sessions) {
      const key = getLocalDateKey(s.timestamp);
      const entry = map.get(key);
      if (entry) {
        entry.faces += s.faceCount;
        entry.sessions += 1;
        if (s.faceCount > 0 && s.avgConfidence > 0) {
          entry.confSum += s.avgConfidence;
          entry.confCount += 1;
        }
      }
    }

    return Array.from(map.entries()).map(([dateKey, agg]) => {
      const dateObj = new Date(`${dateKey}T12:00:00`);
      const label = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return {
        dateKey,
        label,
        faces: agg.faces,
        sessions: agg.sessions,
        avgConfidence: agg.confCount > 0 ? agg.confSum / agg.confCount : 0,
      };
    });
  }, [sessions, rangeDays]);

  const recentSessions = useMemo(() => sessions.slice(0, 6), [sessions]);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Operations Overview"
        description="Summary of real browser-local detection sessions, confidence metrics, and consent-enrolled profiles."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('image')}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1526] px-4 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ImageIcon className="h-4 w-4 text-cyan-400" aria-hidden="true" />
              Analyze Image
            </button>
            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              Start Live Detection
            </button>
          </div>
        }
      />

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Faces Detected"
          value={stats.totalFaces}
          detail="Across all recorded local sessions"
          highlight={stats.totalFaces > 0}
        />
        <StatCard
          label="Detection Sessions"
          value={stats.totalSessions}
          detail={`${stats.liveCount} live camera · ${stats.imageCount} image analysis`}
        />
        <StatCard
          label="Average Confidence"
          value={stats.meanConfidence !== null ? formatPercent(stats.meanConfidence) : '—'}
          detail={
            stats.meanConfidence !== null
              ? `Model: ${settings.detectorModel === 'tiny' ? 'TinyFaceDetector' : 'SSD MobileNet v1'}`
              : 'Run a detection to measure score'
          }
        />
        <StatCard
          label="Authorized Profiles"
          value={profiles.length}
          detail={
            settings.recognitionEnabled
              ? 'Opt-in identity matching enabled'
              : 'Detection-only mode active'
          }
        />
      </div>

      {/* Main Chart + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6 lg:col-span-8">
          <div className="flex flex-col gap-4 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-100">
                Detection Activity
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Real sessions captured on this device over the selected window
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-800 bg-[#080E1A] p-0.5">
                {(['faces', 'sessions'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setChartMetric(m)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      chartMetric === m
                        ? 'bg-[#17243F] text-cyan-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m === 'faces' ? 'Faces' : 'Sessions'}
                  </button>
                ))}
              </div>

              <div className="flex items-center rounded-lg border border-slate-800 bg-[#080E1A] p-0.5">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setRangeDays(days)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      rangeDays === days
                        ? 'bg-[#17243F] text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-[#080E1A]/60 px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-200">
                  No detection sessions recorded yet
                </p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                  OPTIVEX never fabricates telemetry. Start a live camera stream or analyze a photo
                  to record real face counts and confidence metrics here.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('image')}
                    className="min-h-[40px] rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 whitespace-nowrap cursor-pointer"
                  >
                    Analyze an Image
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('live')}
                    className="min-h-[40px] rounded-lg border border-slate-700 bg-[#0D1526] px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 whitespace-nowrap cursor-pointer"
                  >
                    Open Live Camera
                  </button>
                </div>
              </div>
            ) : (
              <ActivityChart data={chartData} metric={chartMetric} height={240} />
            )}
          </div>
        </div>

        {/* Workspace Quick Actions */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-[#0D1526] p-6 lg:col-span-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100">
              Detection Workflows
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Launch a real-time or static computer vision session.
            </p>

            <div className="mt-5 divide-y divide-slate-800/80 border-t border-b border-slate-800/80">
              <button
                type="button"
                onClick={() => onNavigate('live')}
                className="flex w-full items-center justify-between gap-3 py-4 text-left transition-colors hover:text-cyan-300 cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-100">Live Face Detection</div>
                  <div className="text-xs text-slate-400">
                    Real-time webcam bounding boxes and landmarks
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('image')}
                className="flex w-full items-center justify-between gap-3 py-4 text-left transition-colors hover:text-cyan-300 cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-100">Image Analysis</div>
                  <div className="text-xs text-slate-400">
                    Multi-face upload inspection and PNG export
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('recognition')}
                className="flex w-full items-center justify-between gap-3 py-4 text-left transition-colors hover:text-cyan-300 cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-100">
                    Consent-Based Recognition
                  </div>
                  <div className="text-xs text-slate-400">
                    Enroll authorized profiles and verify matches
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2.5 text-xs text-slate-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" aria-hidden="true" />
            <span>
              All facial inference executes locally in your browser. History saves only summary
              telemetry unless explicitly cleared.
            </span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800/70 pb-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100">
              Recent Activity
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Latest detection sessions recorded on this device
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 whitespace-nowrap cursor-pointer"
          >
            View All History
          </button>
        </div>

        {recentSessions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Recent sessions will appear here after you complete an image scan or live camera
            session.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Timestamp</th>
                  <th className="py-2.5 pr-4 font-medium">Mode</th>
                  <th className="py-2.5 pr-4 font-medium">Source</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Faces</th>
                  <th className="py-2.5 text-right font-medium">Avg Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-800/25">
                    <td className="py-3 pr-4 font-mono text-slate-300 tabular-nums whitespace-nowrap">
                      {formatTimestamp(session.timestamp)}
                    </td>
                    <td className="py-3 pr-4 text-slate-200 whitespace-nowrap">
                      {session.type === 'live' ? 'Live Camera' : 'Image Analysis'}
                    </td>
                    <td className="py-3 pr-4 text-slate-300 max-w-[220px] truncate">
                      {session.sourceLabel}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono font-medium text-cyan-400 tabular-nums">
                      {session.faceCount}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-200 tabular-nums">
                      {session.faceCount > 0 ? formatPercent(session.avgConfidence) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
