import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Image as ImageIcon, RefreshCw, Upload, Users } from 'lucide-react';
import {
  cropFaceThumbnail,
  detectFaces,
  drawDetectionsOnCanvas,
} from '../../services/visionEngine';
import type {
  AuthorizedProfile,
  DetectedFaceResult,
  DetectionSessionRecord,
  DetectorModel,
  ModelLoadState,
  VisionSettings,
} from '../../types/vision';
import { formatPercent, generateId } from '../../utils/formatters';
import { SectionHeader, StatusNotice } from '../ui/Primitives';

interface ImageAnalysisViewProps {
  settings: VisionSettings;
  authorizedProfiles: AuthorizedProfile[];
  modelState: ModelLoadState;
  onModelStateChange: (state: ModelLoadState) => void;
  onSessionSaved: (session: DetectionSessionRecord) => void;
}

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const SAMPLE_IMAGES = [
  {
    id: 'studio-team',
    label: 'Studio Team (Multi-Face)',
    src: '/src/assets/images/sample_studio_team_1795266277662.jpg',
  },
  {
    id: 'lead-portrait',
    label: 'Engineer Portrait (Single)',
    src: '/src/assets/images/sample_portrait_lead_1795266278417.jpg',
  },
];

interface FaceWithThumb extends DetectedFaceResult {
  thumbUrl?: string;
}

export function ImageAnalysisView({
  settings,
  authorizedProfiles,
  onModelStateChange,
  onSessionSaved,
}: ImageAnalysisViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (activeObjectUrlRef.current) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
        activeObjectUrlRef.current = null;
      }
    };
  }, []);

  const [sourceName, setSourceName] = useState<string>('');
  const [imageDimensions, setImageDimensions] = useState<{ w: number; h: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [processingMs, setProcessingMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [faces, setFaces] = useState<FaceWithThumb[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [detectorModel, setDetectorModel] = useState<DetectorModel>('ssd');
  const [showLandmarks, setShowLandmarks] = useState<boolean>(settings.showLandmarks);
  const [recognitionActive, setRecognitionActive] = useState<boolean>(
    settings.recognitionEnabled && authorizedProfiles.length > 0,
  );

  const renderAnnotatedCanvas = useCallback(
    (img: HTMLImageElement, detected: FaceWithThumb[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw boxes onto a transparent overlay or composite directly
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw detection overlays on top of image
      const overlay = document.createElement('canvas');
      overlay.width = canvas.width;
      overlay.height = canvas.height;
      const octx = overlay.getContext('2d');
      if (octx) {
        drawDetectionsOnCanvas(octx, overlay.width, overlay.height, detected, {
          showLandmarks,
          recognitionActive: recognitionActive && authorizedProfiles.length > 0,
        });
        ctx.drawImage(overlay, 0, 0);
      }
    },
    [authorizedProfiles.length, recognitionActive, showLandmarks],
  );

  const analyzeImageElement = useCallback(
    async (img: HTMLImageElement, label: string, recordSession: boolean) => {
      setAnalyzing(true);
      setErrorMessage(null);
      const t0 = performance.now();

      try {
        const useDescriptors = recognitionActive && authorizedProfiles.length > 0;

        const detected = await detectFaces(img, {
          model: detectorModel,
          scoreThreshold: settings.confidenceThreshold,
          inputSize: settings.inputSize,
          includeLandmarks: showLandmarks || useDescriptors,
          includeDescriptors: useDescriptors,
          authorizedProfiles: useDescriptors ? authorizedProfiles : [],
          matchThreshold: settings.matchThreshold,
          onModelStateChange,
        });

        const withThumbs: FaceWithThumb[] = detected.map((f) => ({
          ...f,
          thumbUrl: cropFaceThumbnail(img, f.box),
        }));

        const dt = Math.round(performance.now() - t0);
        loadedImageRef.current = img;
        setSourceName(label);
        setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        setFaces(withThumbs);
        setProcessingMs(dt);

        if (recordSession && settings.saveSessionHistory) {
          const scores = withThumbs.map((f) => f.score);
          const avgConf =
            scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          const matchedNames = Array.from(
            new Set(withThumbs.map((f) => f.match?.name).filter((n): n is string => Boolean(n))),
          );

          onSessionSaved({
            id: generateId('img'),
            timestamp: new Date().toISOString(),
            type: 'image',
            sourceLabel: label,
            faceCount: withThumbs.length,
            peakFaceCount: withThumbs.length,
            avgConfidence: avgConf,
            minConfidence: scores.length > 0 ? Math.min(...scores) : 0,
            maxConfidence: scores.length > 0 ? Math.max(...scores) : 0,
            durationMs: dt,
            matchedNames,
            modelUsed: detectorModel,
            recognitionActive: useDescriptors,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Face detection failed for this image.';
        setErrorMessage(message);
        onModelStateChange({ status: 'error', loadedModels: [], errorMessage: message });
      } finally {
        setAnalyzing(false);
      }
    },
    [
      authorizedProfiles,
      detectorModel,
      onModelStateChange,
      onSessionSaved,
      recognitionActive,
      settings.confidenceThreshold,
      settings.inputSize,
      settings.matchThreshold,
      settings.saveSessionHistory,
      showLandmarks,
    ],
  );

  // Paint annotated canvas deterministically once DOM <canvas> is committed
  useEffect(() => {
    if (loadedImageRef.current && imageDimensions) {
      renderAnnotatedCanvas(loadedImageRef.current, faces);
    }
  }, [faces, imageDimensions, renderAnnotatedCanvas]);

  // Re-run detection if user switches model, toggles landmarks on, or toggles recognition on a loaded image
  useEffect(() => {
    if (loadedImageRef.current && sourceName) {
      void analyzeImageElement(loadedImageRef.current, sourceName, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectorModel, showLandmarks, recognitionActive]);

  const loadImageFromSrc = (src: string, label: string) => {
    setErrorMessage(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      void analyzeImageElement(img, label, true);
    };
    img.onerror = () => {
      setErrorMessage(`Could not load image "${label}". Verify the file is a valid raster photo.`);
    };
    img.src = src;
  };

  const handleFile = (file: File) => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setErrorMessage(
        `Unsupported file format (${file.type || 'unknown'}). Upload a JPEG, PNG, or WebP image.`,
      );
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMessage('File exceeds the 15 MB local processing limit. Choose a smaller image.');
      return;
    }

    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }

    const objectUrl = URL.createObjectURL(file);
    activeObjectUrlRef.current = objectUrl;
    const img = new Image();
    img.onload = () => {
      void analyzeImageElement(img, file.name, true);
    };
    img.onerror = () => {
      if (activeObjectUrlRef.current === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        activeObjectUrlRef.current = null;
      }
      setErrorMessage('The selected file could not be decoded as a valid image.');
    };
    img.src = objectUrl;
  };

  const handleDownloadAnnotated = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceName) return;
    const img = loadedImageRef.current;
    if (img && (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight)) {
      renderAnnotatedCanvas(img, faces);
    }
    const baseName = sourceName.replace(/\.[^.]+$/, '');
    const link = document.createElement('a');
    link.download = `optivex-annotated-${baseName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleReanalyze = () => {
    if (loadedImageRef.current && sourceName) {
      void analyzeImageElement(loadedImageRef.current, sourceName, false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Image Analysis"
        description="Upload still photography to detect multiple faces, inspect confidence scores, and export annotated PNG deliverables."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload Image
            </button>
            {imageDimensions ? (
              <button
                type="button"
                onClick={handleDownloadAnnotated}
                disabled={analyzing}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1526] px-4 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                Download Annotated
              </button>
            ) : null}
          </div>
        }
      />

      {errorMessage ? (
        <StatusNotice variant="error" title="Image Validation Error" message={errorMessage} />
      ) : null}

      {/* Sample & Analysis Controls Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-800/80 bg-[#0D1526] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-medium text-slate-400">Sample Imagery:</span>
          {SAMPLE_IMAGES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={analyzing}
              onClick={() => loadImageFromSrc(sample.src, sample.label)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#080E1A] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-400/60 hover:text-cyan-300 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Users className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              {sample.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <label htmlFor="img-detector" className="text-slate-400">
              Detector:
            </label>
            <select
              id="img-detector"
              value={detectorModel}
              onChange={(e) => setDetectorModel(e.target.value as DetectorModel)}
              className="min-h-[36px] rounded-lg border border-slate-700 bg-[#080E1A] px-2.5 py-1 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              <option value="ssd">SSD MobileNet v1 (Precision)</option>
              <option value="tiny">TinyFaceDetector (Fast)</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={showLandmarks}
              onChange={(e) => setShowLandmarks(e.target.checked)}
              className="h-4 w-4 accent-cyan-400 cursor-pointer"
            />
            Landmarks
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={recognitionActive}
              disabled={authorizedProfiles.length === 0}
              onChange={(e) => setRecognitionActive(e.target.checked)}
              className="h-4 w-4 accent-cyan-400 disabled:opacity-40 cursor-pointer"
            />
            <span className={authorizedProfiles.length === 0 ? 'text-slate-500' : ''}>
              Match Authorized ({authorizedProfiles.length})
            </span>
          </label>

          {loadedImageRef.current ? (
            <button
              type="button"
              onClick={handleReanalyze}
              disabled={analyzing}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#121D33] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? 'animate-spin' : ''}`} />
              Re-Run
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Annotated Canvas Workspace */}
        <div className="lg:col-span-8">
          {!imageDimensions && !analyzing ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              className={`flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-950/15'
                  : 'border-slate-700/80 bg-[#0D1526]'
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-800 bg-[#080E1A]">
                <ImageIcon className="h-6 w-6 text-cyan-400" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-slate-100">
                Drop an image here or select a file
              </h3>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-400">
                Supports JPEG, PNG, and WebP up to 15 MB. Detection runs locally inside your browser
                and returns multi-face bounding boxes with confidence percentages.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[42px] rounded-lg bg-cyan-400 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 cursor-pointer"
                >
                  Choose Local Image
                </button>
                <button
                  type="button"
                  onClick={() =>
                    loadImageFromSrc(SAMPLE_IMAGES[0].src, SAMPLE_IMAGES[0].label)
                  }
                  className="min-h-[42px] rounded-lg border border-slate-700 bg-[#080E1A] px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 cursor-pointer"
                >
                  Load Multi-Face Sample
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-[#050912]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-[#0D1526] px-4 py-3 text-xs">
                <span className="font-medium text-slate-200 truncate">{sourceName}</span>
                <div className="flex items-center gap-3 font-mono text-slate-400 tabular-nums">
                  {imageDimensions ? (
                    <span>
                      {imageDimensions.w}×{imageDimensions.h} px
                    </span>
                  ) : null}
                  {processingMs !== null ? <span>{processingMs} ms</span> : null}
                </div>
              </div>

              <div className="relative flex min-h-[360px] items-center justify-center p-4">
                <canvas
                  ref={canvasRef}
                  className="max-h-[580px] w-auto max-w-full rounded object-contain"
                />
                {analyzing ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070C17]/80 backdrop-blur-xs">
                    <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
                    <span className="mt-3 text-xs font-medium text-slate-200">
                      Running face detection inference…
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Detection Results Panel */}
        <div className="rounded-xl border border-slate-800/80 bg-[#0D1526] p-5 lg:col-span-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Detection Results
            </h3>
            <span className="font-mono text-xs font-semibold text-cyan-400 tabular-nums">
              {faces.length} {faces.length === 1 ? 'Face' : 'Faces'}
            </span>
          </div>

          {faces.length === 0 ? (
            <div className="py-10 text-center text-xs leading-relaxed text-slate-400">
              {analyzing
                ? 'Inspecting image regions…'
                : imageDimensions
                  ? detectorModel === 'tiny'
                    ? 'No faces detected with TinyFaceDetector at the current threshold. Switch to SSD MobileNet v1 for smaller or wide-shot faces, or lower the threshold in Settings.'
                    : 'No faces detected above the current confidence threshold. Try lowering the threshold in Settings.'
                  : 'Upload an image or load a sample photo to view per-face bounding boxes and scores.'}
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-800/80">
              {faces.map((face) => (
                <div key={face.id} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                  {face.thumbUrl ? (
                    <img
                      src={face.thumbUrl}
                      alt={`Detected face ${face.index}`}
                      className="h-12 w-12 shrink-0 rounded-lg border border-slate-700 object-cover"
                    />
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-slate-100">
                        {recognitionActive && face.match
                          ? face.match.name
                          : `Face #${face.index}`}
                      </span>
                      <span className="font-mono text-xs font-semibold text-cyan-400 tabular-nums">
                        {formatPercent(face.score)}
                      </span>
                    </div>

                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-cyan-400"
                        style={{ width: `${Math.min(100, Math.round(face.score * 100))}%` }}
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1 font-mono text-[11px] text-slate-400 tabular-nums">
                      <span>
                        x:{Math.round(face.box.x)} y:{Math.round(face.box.y)}
                      </span>
                      <span>
                        {Math.round(face.box.width)}×{Math.round(face.box.height)} px
                      </span>
                    </div>

                    <div className="mt-1 text-[11px] text-slate-400">
                      {recognitionActive && face.match
                        ? `Authorized Match · ${(face.match.similarity * 100).toFixed(0)}% similarity`
                        : recognitionActive
                          ? 'Unidentified (No enrolled match)'
                          : 'Geometric Detection Only'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
