import React, { useState } from 'react';
import { ArrowRight, Camera, Cpu, Database, Eye, Lock, ShieldCheck, Upload } from 'lucide-react';
import type { WorkspaceSection } from '../../types/vision';
import { OptivexLogo } from '../ui/Primitives';

interface LandingPageProps {
  onEnterWorkspace: (section?: WorkspaceSection) => void;
}

const HERO_IMAGE_SRC = '/src/assets/images/hero_optical_lab_1795266278346.jpg';

export function LandingPage({ onEnterWorkspace }: LandingPageProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-[#070C17] text-slate-100">
      {/* Top Navigation Bar — Strict 3-Zone Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#070C17]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
          >
            OPTIVEX
          </a>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
          >
            <a
              href="#capabilities"
              className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#privacy"
              className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              Privacy
            </a>
            <a
              href="#architecture"
              className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
            <button
              type="button"
              onClick={() => onEnterWorkspace('analytics')}
              className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Analytics
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onEnterWorkspace('dashboard')}
              className="min-h-[40px] rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Launch Platform
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Split */}
        <section className="mx-auto max-w-7xl px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-xs font-medium tracking-wide text-cyan-400">
                OPTIVEX AI · See Beyond. Recognize Smarter.
              </p>

              <h1
                className="mt-4 font-display font-bold tracking-tight text-slate-50 text-balance"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.65rem)', lineHeight: 1.08 }}
              >
                Browser-native facial detection built for verifiable privacy.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
                Run real-time camera detection, inspect multi-face still photography, and perform
                consent-based identity matching directly on-device—with zero covert uploads or
                unsolicited tracking.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onEnterWorkspace('dashboard')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Detection Dashboard
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => onEnterWorkspace('image')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1526] px-5 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:border-slate-500 hover:bg-[#131E35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Analyze an Image
                </button>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-800/80 pt-6">
                <div>
                  <div className="font-mono text-lg font-semibold text-slate-50 tabular-nums">
                    100% Local
                  </div>
                  <div className="mt-1 text-xs text-slate-400">On-device neural inference</div>
                </div>
                <div>
                  <div className="font-mono text-lg font-semibold text-cyan-400 tabular-nums">
                    68-Point
                  </div>
                  <div className="mt-1 text-xs text-slate-400">Facial geometry landmarks</div>
                </div>
                <div>
                  <div className="font-mono text-lg font-semibold text-slate-50 tabular-nums">
                    Opt-In Only
                  </div>
                  <div className="mt-1 text-xs text-slate-400">Consent-gated recognition</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[320px] overflow-hidden rounded-xl border border-slate-800/80 bg-[#0D1526]">
                {!heroImgFailed ? (
                  <img
                    src={HERO_IMAGE_SRC}
                    alt="Precision optical calibration rig in a dark computer vision laboratory"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center bg-[#0D1526] p-8 text-center">
                    <Eye className="h-10 w-10 text-cyan-400" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-slate-200">
                      Optical Calibration & Vision Lab
                    </p>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070C17]/85 via-transparent to-transparent" />
                <div className="absolute right-5 bottom-5 left-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
                  <span>Browser WebGL Inference · Local Model Weights</span>
                  <span className="font-mono text-cyan-300 tabular-nums">128-D Descriptor Ready</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Bento Grid */}
        <section id="capabilities" className="border-t border-slate-800/70 bg-[#091020] py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl text-balance">
                Four integrated computer vision workspaces
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Every module runs real detection models directly inside your browser session and
                separates geometric face localization from optional authorized recognition.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* 01 - Wide Card */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-[#0D1526] p-6 lg:col-span-2">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>01. Live Camera Stream</span>
                    <span>Real-time WebGL</span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold text-slate-50">
                    Live Face Detection Workspace
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                    Request camera access with explicit permission, inspect real-time bounding
                    boxes, confidence scores, and optional 68-point facial landmarks, and capture
                    annotated frames with Start, Pause, and Stop session controls.
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/70 pt-4">
                  <span className="text-xs text-slate-400">
                    Supports TinyFaceDetector & SSD MobileNet v1
                  </span>
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('live')}
                    className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Open Live Detection
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* 02 - Standard Card */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>02. Still Imagery</span>
                    <span>PNG / JPEG / WebP</span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold text-slate-50">
                    Multi-Face Image Analysis
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Upload high-resolution photos or studio portraits to locate multiple faces,
                    inspect per-face confidence metrics, and download annotated PNG outputs.
                  </p>
                </div>
                <div className="mt-6 border-t border-slate-800/70 pt-4">
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('image')}
                    className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Launch Image Analysis
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* 03 - Standard Card */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-[#0D1526] p-6">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>03. Opt-In Verification</span>
                    <span>Local 128-D Vectors</span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold text-slate-50">
                    Consent-Based Recognition
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Disabled by default. Enroll authorized sample profiles only after explicit
                    consent confirmation and compare descriptors locally with transparent distance
                    thresholds.
                  </p>
                </div>
                <div className="mt-6 border-t border-slate-800/70 pt-4">
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('recognition')}
                    className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Manage Authorized Profiles
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* 04 - Wide Card */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-[#0D1526] p-6 lg:col-span-2">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>04. Telemetry & Audit</span>
                    <span>Local Ledger</span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold text-slate-50">
                    Detection History & Performance Analytics
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                    Review searchable detection sessions, daily and weekly detection trends, and
                    confidence distributions derived solely from your recorded camera and image
                    sessions—with single-record and full-ledger deletion controls.
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/70 pt-4">
                  <span className="text-xs text-slate-400">
                    Export session logs to JSON or CSV anytime
                  </span>
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('analytics')}
                    className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    View Analytics
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Architecture */}
        <section id="privacy" className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <div id="architecture" className="max-w-2xl">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl text-balance">
              Engineered around privacy boundaries
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              OPTIVEX separates geometric face detection from biometric identity matching and keeps
              all computation inside your browser sandbox.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 border-t border-slate-800/80 pt-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2.5">
              <Camera className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-slate-100">
                Explicit Camera Gate
              </h3>
              <p className="text-xs leading-relaxed text-slate-400">
                Camera hardware is never accessed until you initiate a session and approve the
                browser permission prompt.
              </p>
            </div>

            <div className="space-y-2.5">
              <Cpu className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-slate-100">
                On-Device Inference
              </h3>
              <p className="text-xs leading-relaxed text-slate-400">
                Neural network weights load locally from application assets and process video frames
                without uploading media to remote servers.
              </p>
            </div>

            <div className="space-y-2.5">
              <ShieldCheck className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-slate-100">
                Consent-Only Recognition
              </h3>
              <p className="text-xs leading-relaxed text-slate-400">
                Detection never assigns names. Identity matching only activates when explicitly
                toggled on against authorized local profiles.
              </p>
            </div>

            <div className="space-y-2.5">
              <Lock className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-slate-100">
                Complete Erasure Controls
              </h3>
              <p className="text-xs leading-relaxed text-slate-400">
                Revoke individual enrolled descriptors, clear session logs, or wipe all browser
                storage in one action inside Settings.
              </p>
            </div>
          </div>

          {/* Direct Workspace Quick Launch */}
          <div className="mt-14 flex flex-col items-start justify-between gap-6 rounded-xl border border-slate-800/80 bg-[#0D1526] p-8 sm:flex-row sm:items-center">
            <div className="space-y-1.5">
              <h3 className="font-display text-xl font-semibold text-slate-50">
                Ready to inspect real detections?
              </h3>
              <p className="text-sm text-slate-400">
                Start with a live camera feed, upload an image, or enroll an authorized test profile.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onEnterWorkspace('live')}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-700 bg-[#121D33] px-4 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                Live Camera
              </button>
              <button
                type="button"
                onClick={() => onEnterWorkspace('image')}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-700 bg-[#121D33] px-4 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                Image Upload
              </button>
              <button
                type="button"
                onClick={() => onEnterWorkspace('dashboard')}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Database className="h-4 w-4" aria-hidden="true" />
                Open Dashboard
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 bg-[#060A13] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <OptivexLogo />
            <span className="text-xs text-slate-400">See Beyond. Recognize Smarter.</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => onEnterWorkspace('dashboard')}
              className="hover:text-slate-200 cursor-pointer"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => onEnterWorkspace('recognition')}
              className="hover:text-slate-200 cursor-pointer"
            >
              Consent Policy
            </button>
            <button
              type="button"
              onClick={() => onEnterWorkspace('settings')}
              className="hover:text-slate-200 cursor-pointer"
            >
              Privacy Controls
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
