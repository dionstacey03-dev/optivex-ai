import React, { useEffect, useState } from 'react';
import { Camera, Download, RotateCcw, Shield, Trash2 } from 'lucide-react';
import { DEFAULT_SETTINGS, localVisionRepository } from '../../services/storageService';
import type {
  AuthorizedProfile,
  DetectionSessionRecord,
  DetectorModel,
  InputSizeOption,
  VisionSettings,
} from '../../types/vision';
import { formatBytes } from '../../utils/formatters';
import { SectionHeader, StatusNotice } from '../ui/Primitives';

interface SettingsViewProps {
  settings: VisionSettings;
  sessions: DetectionSessionRecord[];
  profiles: AuthorizedProfile[];
  onUpdateSettings: (next: VisionSettings) => void;
  onClearSessions: () => void;
  onClearProfiles: () => void;
  onFactoryReset: () => void;
}

export function SettingsView({
  settings,
  sessions,
  profiles,
  onUpdateSettings,
  onClearSessions,
  onClearProfiles,
  onFactoryReset,
}: SettingsViewProps) {
  const [cameraPermission, setCameraPermission] = useState<string>('Checking…');
  const [cameraCount, setCameraCount] = useState<number | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'sessions' | 'profiles' | 'all' | null>(null);

  const checkCameraStatus = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setCameraPermission('Unsupported in current browser context');
      setCameraCount(0);
      return;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const res = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        setCameraPermission(res.state);
      } else {
        setCameraPermission('Prompt on camera start');
      }
    } catch {
      setCameraPermission('Prompt on camera start');
    }

    try {
      if (navigator.mediaDevices.enumerateDevices) {
        const list = await navigator.mediaDevices.enumerateDevices();
        setCameraCount(list.filter((d) => d.kind === 'videoinput').length);
      }
    } catch {
      setCameraCount(null);
    }
  };

  useEffect(() => {
    void checkCameraStatus();
  }, []);

  const handleExportBundle = () => {
    const bundle = localVisionRepository.exportAllData();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `optivex-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusFeedback('Exported local OPTIVEX settings, sessions, and profiles as JSON.');
  };

  const storageBytes = localVisionRepository.getApproximateStorageBytes();

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Platform Settings & Privacy"
        description="Configure camera hardware permissions, neural detection thresholds, consent-based recognition rules, and local data deletion."
      />

      {statusFeedback ? (
        <StatusNotice variant="success" title="Updated" message={statusFeedback} />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Camera Permissions */}
        <section className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Camera className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-slate-100">
              Camera Permissions
            </h3>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Browser Permission State</span>
              <span className="font-mono font-medium capitalize text-slate-100">
                {cameraPermission}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Detected Video Devices</span>
              <span className="font-mono font-medium text-slate-100 tabular-nums">
                {cameraCount !== null ? cameraCount : 'Unknown'}
              </span>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-slate-800/70 pt-3 text-xs">
              <div>
                <div className="font-medium text-slate-200">Mirror webcam horizontally</div>
                <div className="text-[11px] text-slate-400">
                  Flips self-view horizontally in Live Detection
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.mirrorWebcam}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, mirrorWebcam: e.target.checked })
                }
                className="h-4 w-4 accent-cyan-400 cursor-pointer"
              />
            </label>

            <button
              type="button"
              onClick={() => void checkCameraStatus()}
              className="min-h-[38px] rounded-lg border border-slate-700 bg-[#080E1A] px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 cursor-pointer"
            >
              Refresh Hardware Status
            </button>
          </div>
        </section>

        {/* Detection Preferences */}
        <section className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Detection Preferences
            </h3>
            <button
              type="button"
              onClick={() => {
                onUpdateSettings(DEFAULT_SETTINGS);
                setStatusFeedback('Restored default detection preferences.');
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-cyan-400 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset Defaults
            </button>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            <div>
              <label htmlFor="pref-model" className="block font-medium text-slate-300">
                Default Live Detector Architecture
              </label>
              <select
                id="pref-model"
                value={settings.detectorModel}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    detectorModel: e.target.value as DetectorModel,
                  })
                }
                className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-700 bg-[#080E1A] px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
              >
                <option value="tiny">TinyFaceDetector (Optimized for Real-Time Video)</option>
                <option value="ssd">SSD MobileNet v1 (Higher Multi-Scale Precision)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="pref-conf" className="font-medium text-slate-300">
                  Minimum Confidence Threshold
                </label>
                <span className="font-mono text-cyan-400 tabular-nums">
                  {(settings.confidenceThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                id="pref-conf"
                type="range"
                min={0.3}
                max={0.9}
                step={0.05}
                value={settings.confidenceThreshold}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    confidenceThreshold: Number(e.target.value),
                  })
                }
                className="mt-2 w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <label htmlFor="pref-input-size" className="block font-medium text-slate-300">
                TinyFaceDetector Input Resolution
              </label>
              <select
                id="pref-input-size"
                value={settings.inputSize}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    inputSize: Number(e.target.value) as InputSizeOption,
                  })
                }
                className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-700 bg-[#080E1A] px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
              >
                <option value={224}>224 px (Fastest Frame Rate)</option>
                <option value={320}>320 px (Balanced)</option>
                <option value={416}>416 px (Small / Distant Faces)</option>
              </select>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 pt-1">
              <span className="text-slate-200">Display 68 facial landmarks by default</span>
              <input
                type="checkbox"
                checked={settings.showLandmarks}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, showLandmarks: e.target.checked })
                }
                className="h-4 w-4 accent-cyan-400 cursor-pointer"
              />
            </label>
          </div>
        </section>

        {/* Privacy & Recognition Controls */}
        <section className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Shield className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-slate-100">
              Privacy & Consent Controls
            </h3>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-200">
                  Enable optional identity matching
                </div>
                <div className="text-[11px] text-slate-400">
                  Matches only against locally enrolled authorized profiles
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.recognitionEnabled}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    recognitionEnabled: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-cyan-400 cursor-pointer"
              />
            </label>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="pref-match" className="font-medium text-slate-300">
                  Euclidean Distance Match Strictness
                </label>
                <span className="font-mono text-cyan-400 tabular-nums">
                  {settings.matchThreshold.toFixed(2)}
                </span>
              </div>
              <input
                id="pref-match"
                type="range"
                min={0.38}
                max={0.62}
                step={0.02}
                value={settings.matchThreshold}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    matchThreshold: Number(e.target.value),
                  })
                }
                className="mt-2 w-full accent-cyan-400 cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                <span>0.38 (Strict)</span>
                <span>0.62 (Permissive)</span>
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-slate-800/70 pt-3">
              <div>
                <div className="font-medium text-slate-200">Record session telemetry history</div>
                <div className="text-[11px] text-slate-400">
                  Saves face counts and confidence averages locally (never raw photos/video)
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.saveSessionHistory}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    saveSessionHistory: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-cyan-400 cursor-pointer"
              />
            </label>
          </div>
        </section>

        {/* Data Management */}
        <section className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Local Data Management
            </h3>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {formatBytes(storageBytes)}
            </span>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Stored Detection Sessions</span>
              <span className="font-mono text-slate-200 tabular-nums">{sessions.length}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Enrolled Biometric Profiles</span>
              <span className="font-mono text-slate-200 tabular-nums">{profiles.length}</span>
            </div>

            <div className="space-y-2.5 border-t border-slate-800/70 pt-4">
              <button
                type="button"
                onClick={handleExportBundle}
                className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#080E1A] px-4 py-2 font-medium text-slate-100 hover:border-slate-500 cursor-pointer"
              >
                <Download className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                Export All Local Data (JSON)
              </button>

              {confirmAction === null ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={sessions.length === 0}
                    onClick={() => setConfirmAction('sessions')}
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-950/20 px-3 py-2 font-medium text-rose-200 hover:bg-rose-950/40 disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete History
                  </button>
                  <button
                    type="button"
                    disabled={profiles.length === 0}
                    onClick={() => setConfirmAction('profiles')}
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-950/20 px-3 py-2 font-medium text-rose-200 hover:bg-rose-950/40 disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Purge Profiles
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3">
                  <p className="text-xs text-rose-100">
                    {confirmAction === 'sessions'
                      ? 'Permanently delete all detection history records?'
                      : confirmAction === 'profiles'
                        ? 'Permanently revoke and erase all authorized biometric profiles?'
                        : 'Erase all settings, history, and enrolled profiles from this browser?'}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirmAction === 'sessions') {
                          onClearSessions();
                          setStatusFeedback('All detection history records deleted.');
                        } else if (confirmAction === 'profiles') {
                          onClearProfiles();
                          setStatusFeedback('All enrolled biometric profiles purged.');
                        } else {
                          onFactoryReset();
                          setStatusFeedback('All local OPTIVEX data erased.');
                        }
                        setConfirmAction(null);
                      }}
                      className="min-h-[36px] rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400 cursor-pointer"
                    >
                      Confirm Erase
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="min-h-[36px] rounded-md border border-slate-700 bg-[#080E1A] px-3 py-1.5 text-xs text-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {confirmAction === null ? (
                <button
                  type="button"
                  onClick={() => setConfirmAction('all')}
                  className="min-h-[38px] w-full rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:border-rose-500/40 hover:text-rose-300 cursor-pointer"
                >
                  Wipe All Local Application Data
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
