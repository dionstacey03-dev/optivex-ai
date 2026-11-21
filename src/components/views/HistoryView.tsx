import React, { useMemo, useState } from 'react';
import { Download, Search, Trash2 } from 'lucide-react';
import type { DetectionSessionRecord, WorkspaceSection } from '../../types/vision';
import { formatDuration, formatPercent, formatTimestamp } from '../../utils/formatters';
import { SectionHeader } from '../ui/Primitives';

interface HistoryViewProps {
  sessions: DetectionSessionRecord[];
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
  onNavigate: (section: WorkspaceSection) => void;
}

export function HistoryView({
  sessions,
  onDeleteSession,
  onClearAll,
  onNavigate,
}: HistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'live' | 'image'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'faces' | 'confidence'>('newest');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = sessions.filter((s) => {
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      if (!q) return true;
      return (
        s.sourceLabel.toLowerCase().includes(q) ||
        s.modelUsed.toLowerCase().includes(q) ||
        s.matchedNames.some((n) => n.toLowerCase().includes(q))
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'faces') return b.faceCount - a.faceCount;
      if (sortBy === 'confidence') return b.avgConfidence - a.avgConfidence;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [sessions, searchQuery, typeFilter, sortBy]);

  const handleExportCsv = () => {
    const headers = [
      'id',
      'timestamp',
      'type',
      'sourceLabel',
      'faceCount',
      'avgConfidence',
      'durationMs',
      'modelUsed',
      'recognitionActive',
      'matchedNames',
    ];
    const rows = filteredSessions.map((s) =>
      [
        s.id,
        s.timestamp,
        s.type,
        `"${s.sourceLabel.replace(/"/g, '""')}"`,
        s.faceCount,
        s.avgConfidence.toFixed(4),
        s.durationMs,
        s.modelUsed,
        s.recognitionActive,
        `"${s.matchedNames.join('; ').replace(/"/g, '""')}"`,
      ].join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `optivex-detection-history-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Detection History"
        description="Searchable local ledger of completed camera and image detection sessions. Raw camera frames and images are never saved."
        action={
          sessions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1526] px-4 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500 whitespace-nowrap cursor-pointer"
              >
                <Download className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                Export CSV
              </button>
              {!confirmClearAll ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-950/20 px-4 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-950/40 whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Clear All
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll();
                      setConfirmClearAll(false);
                    }}
                    className="min-h-[40px] rounded-lg bg-rose-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-400 whitespace-nowrap cursor-pointer"
                  >
                    Confirm Delete All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="min-h-[40px] rounded-lg border border-slate-700 bg-[#0D1526] px-3 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : null
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-[#0D1526] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by source, model, or authorized name…"
            aria-label="Search detection history"
            className="min-h-[40px] w-full rounded-lg border border-slate-700 bg-[#080E1A] pr-3 pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-slate-800 bg-[#080E1A] p-0.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'live', label: 'Live Camera' },
                { id: 'image', label: 'Image Analysis' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  typeFilter === tab.id
                    ? 'bg-[#17243F] text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'faces' | 'confidence')}
            aria-label="Sort detection history"
            className="min-h-[38px] rounded-lg border border-slate-700 bg-[#080E1A] px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="faces">Most Faces</option>
            <option value="confidence">Highest Confidence</option>
          </select>
        </div>
      </div>

      {/* Records Table */}
      <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
        {sessions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-200">No detection records yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Complete a live camera session or analyze an image to populate your session history.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('live')}
                className="min-h-[40px] rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 cursor-pointer"
              >
                Start Live Camera
              </button>
              <button
                type="button"
                onClick={() => onNavigate('image')}
                className="min-h-[40px] rounded-lg border border-slate-700 bg-[#080E1A] px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 cursor-pointer"
              >
                Analyze Image
              </button>
            </div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No session records match your current search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Timestamp</th>
                  <th className="py-2.5 pr-4 font-medium">Mode</th>
                  <th className="py-2.5 pr-4 font-medium">Source</th>
                  <th className="py-2.5 pr-4 font-medium">Model</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Faces</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Confidence</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Duration</th>
                  <th className="py-2.5 pr-4 font-medium">Identity Status</th>
                  <th className="py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-800/25">
                    <td className="py-3 pr-4 font-mono text-slate-300 tabular-nums whitespace-nowrap">
                      {formatTimestamp(session.timestamp)}
                    </td>
                    <td className="py-3 pr-4 text-slate-200 whitespace-nowrap">
                      {session.type === 'live' ? 'Live Camera' : 'Image'}
                    </td>
                    <td className="py-3 pr-4 text-slate-200 max-w-[180px] truncate">
                      {session.sourceLabel}
                    </td>
                    <td className="py-3 pr-4 font-mono text-slate-400 whitespace-nowrap">
                      {session.modelUsed === 'ssd' ? 'SSD-v1' : 'TinyFace'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono font-semibold text-cyan-400 tabular-nums">
                      {session.faceCount}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-slate-200 tabular-nums">
                      {session.faceCount > 0 ? formatPercent(session.avgConfidence) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-slate-300 tabular-nums whitespace-nowrap">
                      {formatDuration(session.durationMs)}
                    </td>
                    <td className="py-3 pr-4 text-slate-400 max-w-[180px] truncate">
                      {session.matchedNames.length > 0
                        ? session.matchedNames.join(', ')
                        : session.recognitionActive
                          ? 'No authorized match'
                          : 'Detection Only'}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteSession(session.id)}
                        aria-label={`Delete record from ${formatTimestamp(session.timestamp)}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-950/40 hover:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
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
