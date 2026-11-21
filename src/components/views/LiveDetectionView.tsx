import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Aperture,
  Camera,
  CameraOff,
  Download,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Square,
  Trash2,
} from 'lucide-react';
import {
  detectFaces,
  drawDetectionsOnCanvas,
  ensureVisionModelsLoaded,
} from '../../services/visionEngine';
import type {
  AuthorizedProfile,
  DetectedFaceResult,
  DetectionSessionRecord,
  ModelLoadState,
  VisionEffectMode,
  VisionSettings,
} from '../../types/vision';
import { formatDuration, formatPercent, generateId } from '../../utils/formatters';
import { renderVisionEffectFrame, VISION_EFFECT_OPTIONS } from '../../utils/visionEffects';
import { SectionHeader, StatusNotice } from '../ui/Primitives';

interface LiveDetectionViewProps {
  settings: VisionSettings;
  authorizedProfiles: AuthorizedProfile[];
  modelState: ModelLoadState;
  onModelStateChange: (state: ModelLoadState) => void;
  onSessionSaved: (session: DetectionSessionRecord) => void;
  onOpenRecognition: () => void;
}

type StreamPhase = 'idle' | 'requesting' | 'active' | 'paused' | 'error';

interface CapturedSnapshot {
  id: string;
  dataUrl: string;
  filename: string;
  capturedAt: string;
  faceCount: number;
  avgConfidence: number | null;
  width: number;
  height: number;
}

export function LiveDetectionView({
  settings,
  authorizedProfiles,
  modelState,
  onModelStateChange,
  onSessionSaved,
  onOpenRecognition,
}: LiveDetectionViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const effectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const aiInputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const isInferringRef = useRef(false);
  const phaseRef = useRef<StreamPhase>('idle');

  // Session accumulation refs
  const sessionStartMsRef = useRef<number>(0);
  const pausedAtMsRef = useRef<number>(0);
  const peakFacesRef = useRef<number>(0);
  const confidenceSamplesRef = useRef<number[]>([]);
  const matchedSetRef = useRef<Set<string>>(new Set());
  const shutterTimerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<StreamPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [liveFaces, setLiveFaces] = useState<DetectedFaceResult[]>([]);
  const [inferenceMs, setInferenceMs] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [peakFaces, setPeakFaces] = useState<number>(0);
  const [mirrorFeed, setMirrorFeed] = useState<boolean>(settings.mirrorWebcam);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(settings.showLandmarks);
  const [visionEffect, setVisionEffect] = useState<VisionEffectMode>('standard');
  const [recognitionActive, setRecognitionActive] = useState<boolean>(
    settings.recognitionEnabled && authorizedProfiles.length > 0,
  );
  const [lastSavedNotice, setLastSavedNotice] = useState<string | null>(null);
  const [capturedSnapshots, setCapturedSnapshots] = useState<CapturedSnapshot[]>([]);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);

  const cameraSupported =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (authorizedProfiles.length === 0 && recognitionActive) {
      setRecognitionActive(false);
    }
  }, [authorizedProfiles.length, recognitionActive]);

  // Keep elapsed timer running while active
  useEffect(() => {
    if (phase !== 'active') return;
    const timer = window.setInterval(() => {
      if (sessionStartMsRef.current > 0) {
        setElapsedMs(Date.now() - sessionStartMsRef.current);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [phase]);

  const stopStreamTracks = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (effectCanvasRef.current) {
      const ectx = effectCanvasRef.current.getContext('2d');
      ectx?.clearRect(0, 0, effectCanvasRef.current.width, effectCanvasRef.current.height);
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  // Ensure camera and transient timers are always released on unmount
  useEffect(() => {
    return () => {
      if (shutterTimerRef.current !== null) {
        window.clearTimeout(shutterTimerRef.current);
      }
      stopStreamTracks();
    };
  }, [stopStreamTracks]);

  const applyEffectToCanvases = useCallback(
    (video: HTMLVideoElement, mode: VisionEffectMode): HTMLVideoElement | HTMLCanvasElement => {
      if (mode === 'standard') {
        if (effectCanvasRef.current && video.videoWidth > 0) {
          const ectx = effectCanvasRef.current.getContext('2d');
          ectx?.clearRect(0, 0, effectCanvasRef.current.width, effectCanvasRef.current.height);
        }
        return video;
      }

      if (!workCanvasRef.current) {
        workCanvasRef.current = document.createElement('canvas');
      }
      if (!aiInputCanvasRef.current) {
        aiInputCanvasRef.current = document.createElement('canvas');
      }

      const displayCanvas = effectCanvasRef.current;
      if (!displayCanvas) return video;

      renderVisionEffectFrame(
        video,
        displayCanvas,
        workCanvasRef.current,
        mode,
        mode === 'edge' ? aiInputCanvasRef.current : null,
      );

      return mode === 'edge' ? aiInputCanvasRef.current : displayCanvas;
    },
    [],
  );

  // Immediately refresh effect layer if user switches Vision Effects while paused
  useEffect(() => {
    const video = videoRef.current;
    if ((phase === 'paused' || phase === 'active') && video && video.readyState >= 2) {
      applyEffectToCanvases(video, visionEffect);
    }
  }, [applyEffectToCanvases, phase, visionEffect]);

  const runDetectionTick = useCallback(async () => {
    if (phaseRef.current !== 'active') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(() => {
        void runDetectionTick();
      });
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const inferenceSource = applyEffectToCanvases(video, visionEffect);

    if (!isInferringRef.current) {
      isInferringRef.current = true;
      const t0 = performance.now();
      try {
        const useDescriptors = recognitionActive && authorizedProfiles.length > 0;
        const faces = await detectFaces(inferenceSource, {
          model: settings.detectorModel,
          scoreThreshold: settings.confidenceThreshold,
          inputSize: settings.inputSize,
          includeLandmarks: showLandmarks || useDescriptors,
          includeDescriptors: useDescriptors,
          authorizedProfiles: useDescriptors ? authorizedProfiles : [],
          matchThreshold: settings.matchThreshold,
        });

        const dt = Math.round(performance.now() - t0);
        if (phaseRef.current === 'active') {
          setInferenceMs(dt);
          setLiveFaces(faces);

          if (faces.length > peakFacesRef.current) {
            peakFacesRef.current = faces.length;
            setPeakFaces(faces.length);
          }

          for (const f of faces) {
            confidenceSamplesRef.current.push(f.score);
            if (f.match) {
              matchedSetRef.current.add(f.match.name);
            }
          }

          const ctx = canvas.getContext('2d');
          if (ctx) {
            drawDetectionsOnCanvas(ctx, canvas.width, canvas.height, faces, {
              showLandmarks,
              mirrorHorizontal: mirrorFeed,
              recognitionActive: useDescriptors,
            });
          }
        }
      } catch (err) {
        console.error('Live detection error:', err);
      } finally {
        isInferringRef.current = false;
      }
    }

    if (phaseRef.current === 'active') {
      rafRef.current = requestAnimationFrame(() => {
        void runDetectionTick();
      });
    }
  }, [
    applyEffectToCanvases,
    authorizedProfiles,
    mirrorFeed,
    recognitionActive,
    settings.confidenceThreshold,
    settings.detectorModel,
    settings.inputSize,
    settings.matchThreshold,
    showLandmarks,
    visionEffect,
  ]);

  // Restart loop when visual/recognition options change while active
  useEffect(() => {
    if (phase === 'active') {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        void runDetectionTick();
      });
    }
  }, [phase, runDetectionTick]);

  const startCamera = async (overrideDeviceId?: string) => {
    if (!cameraSupported) {
      setPhase('error');
      setErrorMessage(
        'Camera API (navigator.mediaDevices.getUserMedia) is unavailable in this browser context.',
      );
      return;
    }

    setLastSavedNotice(null);
    setSnapshotNotice(null);
    setErrorMessage(null);
    setPhase('requesting');

    try {
      await ensureVisionModelsLoaded({
        includeRecognition: true,
        onStateChange: onModelStateChange,
      });

      stopStreamTracks();

      const targetDevice = overrideDeviceId ?? selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: targetDevice
          ? { deviceId: { exact: targetDevice }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (navigator.mediaDevices.enumerateDevices) {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
        setDevices(videoInputs);
        const activeTrack = stream.getVideoTracks()[0];
        const activeId = activeTrack?.getSettings().deviceId;
        if (activeId) setSelectedDeviceId(activeId);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      sessionStartMsRef.current = Date.now();
      peakFacesRef.current = 0;
      confidenceSamplesRef.current = [];
      matchedSetRef.current = new Set();
      setPeakFaces(0);
      setElapsedMs(0);
      setLiveFaces([]);
      setPhase('active');
    } catch (err) {
      stopStreamTracks();
      setPhase('error');
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage(
            'Camera permission was denied. Allow camera access in your browser site settings and retry.',
          );
          return;
        }
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setErrorMessage(
            'No webcam or video capture device was detected on this system. You can still test detection in Image Analysis.',
          );
          return;
        }
        if (err.name === 'NotReadableError') {
          setErrorMessage(
            'Camera hardware is currently in use by another application. Close the other app and retry.',
          );
          return;
        }
      }
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to start camera stream.',
      );
    }
  };

  const pauseDetection = () => {
    if (phase === 'active') {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pausedAtMsRef.current = Date.now();
      videoRef.current?.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      if (pausedAtMsRef.current > 0) {
        sessionStartMsRef.current += Date.now() - pausedAtMsRef.current;
        pausedAtMsRef.current = 0;
      }
      void videoRef.current?.play().catch(() => {});
      setPhase('active');
    }
  };

  const stopAndSaveSession = () => {
    if (phase === 'paused' && pausedAtMsRef.current > 0) {
      sessionStartMsRef.current += Date.now() - pausedAtMsRef.current;
      pausedAtMsRef.current = 0;
    }
    const duration =
      sessionStartMsRef.current > 0 ? Date.now() - sessionStartMsRef.current : elapsedMs;
    const samples = confidenceSamplesRef.current;
    const peak = peakFacesRef.current;
    const matched = Array.from(matchedSetRef.current);

    stopStreamTracks();
    setPhase('idle');
    setLiveFaces([]);

    if (settings.saveSessionHistory && duration > 400) {
      const avgConf =
        samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
      const minConf = samples.length > 0 ? Math.min(...samples) : 0;
      const maxConf = samples.length > 0 ? Math.max(...samples) : 0;
      const activeDeviceLabel =
        devices.find((d) => d.deviceId === selectedDeviceId)?.label || 'Browser Webcam';

      const record: DetectionSessionRecord = {
        id: generateId('live'),
        timestamp: new Date().toISOString(),
        type: 'live',
        sourceLabel: activeDeviceLabel,
        faceCount: peak,
        peakFaceCount: peak,
        avgConfidence: avgConf,
        minConfidence: minConf,
        maxConfidence: maxConf,
        durationMs: duration,
        matchedNames: matched,
        modelUsed: settings.detectorModel,
        recognitionActive: recognitionActive && authorizedProfiles.length > 0,
      };
      onSessionSaved(record);
      setLastSavedNotice(
        `Session recorded (${peak} peak ${peak === 1 ? 'face' : 'faces'}, ${formatDuration(duration)}).`,
      );
    }
  };

  const downloadSnapshotDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = video.videoWidth;
    exportCanvas.height = video.videoHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    if (visionEffect !== 'standard') {
      applyEffectToCanvases(video, visionEffect);
    }
    const baseSource =
      visionEffect !== 'standard' && effectCanvasRef.current && effectCanvasRef.current.width > 0
        ? effectCanvasRef.current
        : video;

    if (mirrorFeed) {
      ctx.save();
      ctx.translate(exportCanvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(baseSource, 0, 0, exportCanvas.width, exportCanvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(baseSource, 0, 0, exportCanvas.width, exportCanvas.height);
    }

    // Draw annotations onto a separate transparent overlay canvas because
    // drawDetectionsOnCanvas clears its target context before drawing.
    const overlay = document.createElement('canvas');
    overlay.width = exportCanvas.width;
    overlay.height = exportCanvas.height;
    const octx = overlay.getContext('2d');
    if (octx) {
      drawDetectionsOnCanvas(octx, overlay.width, overlay.height, liveFaces, {
        showLandmarks,
        mirrorHorizontal: mirrorFeed,
        recognitionActive: recognitionActive && authorizedProfiles.length > 0,
      });
      ctx.drawImage(overlay, 0, 0);
    }

    const dataUrl = exportCanvas.toDataURL('image/png');
    const filename = `optivex-live-snapshot-${Date.now()}.png`;
    downloadSnapshotDataUrl(dataUrl, filename);

    const avgConf =
      liveFaces.length > 0
        ? liveFaces.reduce((acc, f) => acc + f.score, 0) / liveFaces.length
        : null;

    const snapshot: CapturedSnapshot = {
      id: generateId('snap'),
      dataUrl,
      filename,
      capturedAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      faceCount: liveFaces.length,
      avgConfidence: avgConf,
      width: exportCanvas.width,
      height: exportCanvas.height,
    };

    setCapturedSnapshots((prev) => [snapshot, ...prev].slice(0, 8));
    setSnapshotNotice(
      `Saved ${filename} (${liveFaces.length} ${liveFaces.length === 1 ? 'face' : 'faces'}, ${exportCanvas.width}×${exportCanvas.height} px). Session remains active.`,
    );
    setShutterFlash(true);
    if (shutterTimerRef.current !== null) {
      window.clearTimeout(shutterTimerRef.current);
    }
    shutterTimerRef.current = window.setTimeout(() => {
      setShutterFlash(false);
      shutterTimerRef.current = null;
    }, 220);
  };

  const currentAvgConfidence =
    liveFaces.length > 0
      ? liveFaces.reduce((acc, f) => acc + f.score, 0) / liveFaces.length
      : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Live Face Detection"
        description="Process camera frames directly inside browser memory with bounding boxes, confidence telemetry, and optional landmarks."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            {phase === 'idle' || phase === 'error' ? (
              <button
                type="button"
                onClick={() => void startCamera()}
                disabled={!cameraSupported || modelState.status === 'loading'}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                Start Camera
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={pauseDetection}
                  disabled={phase === 'requesting'}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1526] px-4 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {phase === 'paused' ? (
                    <>
                      <Play className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 text-amber-400" aria-hidden="true" />
                      Pause
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={captureSnapshot}
                  disabled={phase !== 'active' && phase !== 'paused'}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-cyan-500/40 bg-[#0D1526] px-4 py-2 text-xs font-semibold text-cyan-200 hover:border-cyan-400 hover:bg-[#12203A] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Aperture className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                  Capture Snapshot
                </button>
                <button
                  type="button"
                  onClick={stopAndSaveSession}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-rose-500/90 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  Stop
                </button>
              </>
            )}
          </div>
        }
      />

      {errorMessage ? (
        <StatusNotice
          variant="error"
          title="Camera Access Unavailable"
          message={errorMessage}
          action={
            <button
              type="button"
              onClick={() => void startCamera()}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-950/50 px-3.5 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-900/50 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry Camera
            </button>
          }
        />
      ) : null}

      {snapshotNotice ? (
        <StatusNotice
          variant="info"
          title="Annotated Snapshot Captured"
          message={snapshotNotice}
          action={
            <button
              type="button"
              onClick={() => setSnapshotNotice(null)}
              className="min-h-[34px] rounded-lg border border-cyan-500/30 bg-[#080E1A] px-3 py-1 text-xs font-medium text-cyan-200 hover:border-cyan-400/60 cursor-pointer"
            >
              Dismiss
            </button>
          }
        />
      ) : null}

      {lastSavedNotice ? (
        <StatusNotice
          variant="success"
          title="Session Recorded"
          message={lastSavedNotice}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Video Viewport */}
        <div className="lg:col-span-8">
          <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-[#050912]">
            <div className="relative aspect-video w-full">
              {shutterFlash ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10 border-2 border-cyan-300/80 bg-cyan-300/10"
                />
              ) : null}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`h-full w-full object-contain ${
                  mirrorFeed ? '-scale-x-100' : ''
                } ${
                  phase === 'idle' || phase === 'error' || visionEffect !== 'standard'
                    ? 'opacity-0'
                    : 'opacity-100'
                }`}
              />
              <canvas
                ref={effectCanvasRef}
                className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${
                  mirrorFeed ? '-scale-x-100' : ''
                } ${
                  (phase === 'active' || phase === 'paused') && visionEffect !== 'standard'
                    ? 'opacity-100'
                    : 'opacity-0'
                }`}
              />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />

              {/* Idle / Requesting Overlay */}
              {phase === 'idle' || phase === 'requesting' || phase === 'error' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-800 bg-[#0D1526]">
                    {phase === 'error' ? (
                      <CameraOff className="h-6 w-6 text-rose-400" aria-hidden="true" />
                    ) : (
                      <Camera className="h-6 w-6 text-cyan-400" aria-hidden="true" />
                    )}
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-slate-100">
                    {phase === 'requesting'
                      ? 'Requesting Camera Permission…'
                      : 'Camera Stream Inactive'}
                  </h3>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-400">
                    OPTIVEX requests camera access solely when you click Start Camera. Video frames
                    are evaluated on-device in browser memory and are never transmitted externally.
                  </p>
                  {phase !== 'requesting' ? (
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      disabled={!cameraSupported}
                      className="mt-6 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 cursor-pointer"
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                      Enable Camera & Begin Detection
                    </button>
                  ) : null}
                </div>
              ) : null}

              {/* Paused Overlay */}
              {phase === 'paused' ? (
                <div className="pointer-events-none absolute top-4 left-4 rounded-md border border-amber-500/40 bg-[#070C17]/90 px-3 py-1.5 text-xs font-medium text-amber-300">
                  Detection Paused
                </div>
              ) : null}

              {/* Active Stream Telemetry Bar (only shown when truly streaming) */}
              {phase === 'active' ? (
                <div className="pointer-events-none absolute top-4 left-4 flex items-center gap-2 rounded-md border border-cyan-500/35 bg-[#070C17]/90 px-3 py-1.5 text-xs text-slate-100">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" aria-hidden="true" />
                  <span className="font-mono tabular-nums">
                    LIVE · {liveFaces.length} {liveFaces.length === 1 ? 'Face' : 'Faces'}
                    {visionEffect !== 'standard'
                      ? ` · ${visionEffect === 'grayscale' ? 'GRAYSCALE' : 'EDGE OVERLAY'}`
                      : ''}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Live Metrics Row */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-4">
              <div className="text-xs text-slate-400">Faces in Frame</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-cyan-400 tabular-nums">
                {liveFaces.length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-4">
              <div className="text-xs text-slate-400">Avg Confidence</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-slate-50 tabular-nums">
                {currentAvgConfidence !== null ? formatPercent(currentAvgConfidence) : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-4">
              <div className="text-xs text-slate-400">Inference Time</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-slate-50 tabular-nums">
                {phase === 'active' ? `${inferenceMs} ms` : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-4">
              <div className="text-xs text-slate-400">Session Duration</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-slate-50 tabular-nums">
                {phase === 'active' || phase === 'paused' ? formatDuration(elapsedMs) : '0s'}
              </div>
            </div>
          </div>

          {capturedSnapshots.length > 0 ? (
            <div className="mt-4 rounded-xl border border-slate-800/80 bg-[#0D1526] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-100">
                    Captured Snapshots ({capturedSnapshots.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Annotated PNG captures held temporarily in session memory without interrupting detection.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCapturedSnapshots([])}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#080E1A] px-3 py-1 text-xs font-medium text-slate-300 hover:border-rose-500/40 hover:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear Previews
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {capturedSnapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="overflow-hidden rounded-lg border border-slate-800 bg-[#080E1A]"
                  >
                    <img
                      src={snap.dataUrl}
                      alt={`Annotated capture at ${snap.capturedAt}`}
                      className="aspect-video w-full bg-[#050912] object-contain"
                    />
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
                      <div className="min-w-0">
                        <div className="font-mono text-slate-200 tabular-nums">
                          {snap.capturedAt} · {snap.faceCount}{' '}
                          {snap.faceCount === 1 ? 'Face' : 'Faces'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                          {snap.width}×{snap.height} px
                          {snap.avgConfidence !== null
                            ? ` · ${formatPercent(snap.avgConfidence)}`
                            : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadSnapshotDataUrl(snap.dataUrl, snap.filename)}
                        className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-md border border-slate-700 bg-[#0D1526] px-2.5 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-400/60 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        Save PNG
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Inspector & Controls */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-5">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Stream Controls
            </h3>

            <div className="mt-4 space-y-4">
              {devices.length > 1 ? (
                <div>
                  <label
                    htmlFor="camera-select"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Video Input Device
                  </label>
                  <select
                    id="camera-select"
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value);
                      if (phase === 'active' || phase === 'paused') {
                        void startCamera(e.target.value);
                      }
                    }}
                    className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-700 bg-[#080E1A] px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  >
                    {devices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="vision-effects-select"
                    className="block text-xs font-medium text-slate-200"
                  >
                    Vision Effects
                  </label>
                  <span className="font-mono text-[11px] text-cyan-400">
                    {VISION_EFFECT_OPTIONS.find((o) => o.id === visionEffect)?.label}
                  </span>
                </div>
                <div
                  id="vision-effects-select"
                  role="radiogroup"
                  aria-label="Vision Effects"
                  className="mt-2 grid grid-cols-3 gap-1.5 rounded-lg border border-slate-800 bg-[#080E1A] p-1"
                >
                  {VISION_EFFECT_OPTIONS.map((option) => {
                    const isSelected = visionEffect === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setVisionEffect(option.id)}
                        className={`min-h-[34px] rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? 'border border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
                            : 'border border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {VISION_EFFECT_OPTIONS.find((o) => o.id === visionEffect)?.shortDesc}
                </p>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
                <span className="text-xs text-slate-200">Mirror camera preview</span>
                <input
                  type="checkbox"
                  checked={mirrorFeed}
                  onChange={(e) => setMirrorFeed(e.target.checked)}
                  className="h-4 w-4 accent-cyan-400 cursor-pointer"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
                <span className="text-xs text-slate-200">Overlay 68 facial landmarks</span>
                <input
                  type="checkbox"
                  checked={showLandmarks}
                  onChange={(e) => setShowLandmarks(e.target.checked)}
                  className="h-4 w-4 accent-cyan-400 cursor-pointer"
                />
              </label>

              <div className="border-t border-slate-800/80 pt-3">
                <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
                  <div>
                    <div className="text-xs font-medium text-slate-200">
                      Consent-based identity matching
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {authorizedProfiles.length > 0
                        ? `Compare against ${authorizedProfiles.length} enrolled profile(s)`
                        : 'Enroll an authorized profile first'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={recognitionActive}
                    disabled={authorizedProfiles.length === 0}
                    onChange={(e) => setRecognitionActive(e.target.checked)}
                    className="h-4 w-4 accent-cyan-400 disabled:opacity-40 cursor-pointer"
                  />
                </label>

                {authorizedProfiles.length === 0 ? (
                  <button
                    type="button"
                    onClick={onOpenRecognition}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    Enroll authorized profile
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Live Detected Face Readout */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-100">
                Frame Detections
              </h3>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                Peak: {peakFaces}
              </span>
            </div>

            {liveFaces.length === 0 ? (
              <p className="mt-4 text-xs text-slate-400">
                {phase === 'active'
                  ? 'No faces currently exceeding confidence threshold.'
                  : 'Start camera to inspect real-time face detections and confidence scores.'}
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-800/80">
                {liveFaces.map((face) => (
                  <div key={face.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-100">
                        {recognitionActive && face.match
                          ? face.match.name
                          : `Detected Face #${face.index}`}
                      </span>
                      <span className="font-mono text-cyan-400 tabular-nums">
                        {formatPercent(face.score)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-slate-400 tabular-nums">
                      <span>
                        Box: {Math.round(face.box.width)}×{Math.round(face.box.height)} px
                      </span>
                      <span>
                        {recognitionActive && face.match
                          ? `Match ${(face.match.similarity * 100).toFixed(0)}%`
                          : 'Detection Only'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
