import * as faceapi from '@vladmandic/face-api';
import type {
  AuthorizedProfile,
  DetectedFaceResult,
  DetectorModel,
  IdentityMatch,
  InputSizeOption,
  ModelLoadState,
} from '../types/vision';

const MODEL_BASE_URL = '/models';

let loadPromise: Promise<void> | null = null;
let loadedModelSet = new Set<string>();
let currentLoadState: ModelLoadState = {
  status: 'idle',
  loadedModels: [],
};

export function getModelLoadState(): ModelLoadState {
  return currentLoadState;
}

export async function ensureVisionModelsLoaded(
  options: { includeRecognition?: boolean; onStateChange?: (state: ModelLoadState) => void } = {},
): Promise<ModelLoadState> {
  const { includeRecognition = true, onStateChange } = options;

  const required = [
    'tinyFaceDetector',
    'ssdMobilenetv1',
    'faceLandmark68Net',
    'faceLandmark68TinyNet',
    ...(includeRecognition ? ['faceRecognitionNet'] : []),
  ];

  const allAlreadyLoaded = required.every((name) => loadedModelSet.has(name));
  if (allAlreadyLoaded) {
    currentLoadState = {
      status: 'ready',
      loadedModels: Array.from(loadedModelSet),
    };
    onStateChange?.(currentLoadState);
    return currentLoadState;
  }

  if (loadPromise) {
    await loadPromise;
    onStateChange?.(currentLoadState);
    return currentLoadState;
  }

  currentLoadState = {
    status: 'loading',
    loadedModels: Array.from(loadedModelSet),
  };
  onStateChange?.(currentLoadState);

  loadPromise = (async () => {
    try {
      // Ensure TensorFlow backend is initialized gracefully (WebGL first, fallback to CPU)
      try {
        const tf = faceapi.tf as unknown as {
          getBackend?: () => string;
          setBackend?: (b: string) => Promise<boolean>;
          ready?: () => Promise<void>;
        };
        if (tf?.ready) {
          await tf.ready();
        }
        if (tf?.getBackend && tf?.setBackend && !tf.getBackend()) {
          await tf.setBackend('webgl').catch(() => tf.setBackend!('cpu'));
        }
      } catch {
        // Proceed with face-api default initialization
      }

      const tasks: Array<Promise<void>> = [];

      if (!loadedModelSet.has('tinyFaceDetector')) {
        tasks.push(
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE_URL).then(() => {
            loadedModelSet.add('tinyFaceDetector');
          }),
        );
      }
      if (!loadedModelSet.has('ssdMobilenetv1')) {
        tasks.push(
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_BASE_URL).then(() => {
            loadedModelSet.add('ssdMobilenetv1');
          }),
        );
      }
      if (!loadedModelSet.has('faceLandmark68Net')) {
        tasks.push(
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE_URL).then(() => {
            loadedModelSet.add('faceLandmark68Net');
          }),
        );
      }
      if (!loadedModelSet.has('faceLandmark68TinyNet')) {
        tasks.push(
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_BASE_URL).then(() => {
            loadedModelSet.add('faceLandmark68TinyNet');
          }),
        );
      }
      if (includeRecognition && !loadedModelSet.has('faceRecognitionNet')) {
        tasks.push(
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE_URL).then(() => {
            loadedModelSet.add('faceRecognitionNet');
          }),
        );
      }

      await Promise.all(tasks);

      currentLoadState = {
        status: 'ready',
        loadedModels: Array.from(loadedModelSet),
      };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to initialize browser neural network models.';
      currentLoadState = {
        status: 'error',
        loadedModels: Array.from(loadedModelSet),
        errorMessage: message,
      };
      throw err;
    } finally {
      loadPromise = null;
      onStateChange?.(currentLoadState);
    }
  })();

  await loadPromise;
  return currentLoadState;
}

export function resetModelLoadError(): void {
  if (currentLoadState.status === 'error') {
    currentLoadState = {
      status: 'idle',
      loadedModels: Array.from(loadedModelSet),
    };
  }
}

export function matchDescriptorToProfiles(
  descriptor: Float32Array | number[],
  authorizedProfiles: AuthorizedProfile[],
  maxDistanceThreshold: number,
): IdentityMatch | null {
  if (authorizedProfiles.length === 0) return null;

  let bestProfile: AuthorizedProfile | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const profile of authorizedProfiles) {
    if (!profile.descriptor || profile.descriptor.length !== descriptor.length) {
      continue;
    }
    const distance = faceapi.euclideanDistance(descriptor, profile.descriptor);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestProfile = profile;
    }
  }

  if (!bestProfile || bestDistance > maxDistanceThreshold) {
    return null;
  }

  // Convert Euclidean distance (typically 0.0 - 0.6 for matches) to intuitive similarity score
  const similarity = Math.max(0, Math.min(1, 1 - bestDistance));

  return {
    profileId: bestProfile.id,
    name: bestProfile.name,
    role: bestProfile.role,
    distance: bestDistance,
    similarity,
  };
}

export interface DetectOptions {
  model: DetectorModel;
  scoreThreshold: number;
  inputSize?: InputSizeOption;
  includeLandmarks?: boolean;
  includeDescriptors?: boolean;
  authorizedProfiles?: AuthorizedProfile[];
  matchThreshold?: number;
  onModelStateChange?: (state: ModelLoadState) => void;
}

export async function detectFaces(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  options: DetectOptions,
): Promise<DetectedFaceResult[]> {
  const {
    model,
    scoreThreshold,
    inputSize = 320,
    includeLandmarks = false,
    includeDescriptors = false,
    authorizedProfiles = [],
    matchThreshold = 0.52,
    onModelStateChange,
  } = options;

  await ensureVisionModelsLoaded({
    includeRecognition: includeDescriptors,
    onStateChange: onModelStateChange,
  });

  const detectorOpts =
    model === 'ssd'
      ? new faceapi.SsdMobilenetv1Options({ minConfidence: scoreThreshold })
      : new faceapi.TinyFaceDetectorOptions({
          inputSize,
          scoreThreshold,
        });

  const useTinyLandmarks = model === 'tiny' && !includeDescriptors;

  if (includeDescriptors) {
    const raw = await faceapi
      .detectAllFaces(input, detectorOpts)
      .withFaceLandmarks(useTinyLandmarks)
      .withFaceDescriptors();

    return raw.map((item, idx) => {
      const descriptorArr = Array.from(item.descriptor);
      const match =
        authorizedProfiles.length > 0
          ? matchDescriptorToProfiles(item.descriptor, authorizedProfiles, matchThreshold)
          : null;

      return {
        id: `face-${idx + 1}-${Math.round(item.detection.box.x)}`,
        index: idx + 1,
        box: {
          x: item.detection.box.x,
          y: item.detection.box.y,
          width: item.detection.box.width,
          height: item.detection.box.height,
        },
        score: item.detection.score,
        landmarks: includeLandmarks
          ? item.landmarks.positions.map((pt) => ({ x: pt.x, y: pt.y }))
          : undefined,
        descriptor: descriptorArr,
        match,
      };
    });
  }

  if (includeLandmarks) {
    const raw = await faceapi
      .detectAllFaces(input, detectorOpts)
      .withFaceLandmarks(useTinyLandmarks);

    return raw.map((item, idx) => ({
      id: `face-${idx + 1}-${Math.round(item.detection.box.x)}`,
      index: idx + 1,
      box: {
        x: item.detection.box.x,
        y: item.detection.box.y,
        width: item.detection.box.width,
        height: item.detection.box.height,
      },
      score: item.detection.score,
      landmarks: item.landmarks.positions.map((pt) => ({ x: pt.x, y: pt.y })),
      match: null,
    }));
  }

  const raw = await faceapi.detectAllFaces(input, detectorOpts);
  return raw.map((det, idx) => ({
    id: `face-${idx + 1}-${Math.round(det.box.x)}`,
    index: idx + 1,
    box: {
      x: det.box.x,
      y: det.box.y,
      width: det.box.width,
      height: det.box.height,
    },
    score: det.score,
    match: null,
  }));
}

export interface DrawOverlayOptions {
  showLandmarks?: boolean;
  mirrorHorizontal?: boolean;
  recognitionActive?: boolean;
}

export function drawDetectionsOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  faces: DetectedFaceResult[],
  options: DrawOverlayOptions = {},
): void {
  const { showLandmarks = false, mirrorHorizontal = false, recognitionActive = false } = options;

  ctx.clearRect(0, 0, width, height);

  faces.forEach((face) => {
    const rawX = face.box.x;
    const x = mirrorHorizontal ? width - rawX - face.box.width : rawX;
    const y = face.box.y;
    const w = face.box.width;
    const h = face.box.height;

    const isMatched = recognitionActive && Boolean(face.match);
    const primaryColor = isMatched ? '#22D3EE' : '#38BDF8';
    const subtleFill = isMatched ? 'rgba(34, 211, 238, 0.08)' : 'rgba(56, 189, 248, 0.05)';

    // Subtle interior fill
    ctx.fillStyle = subtleFill;
    ctx.fillRect(x, y, w, h);

    // Hairline full bounding box
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Precision corner brackets
    const cornerLen = Math.max(12, Math.min(24, Math.min(w, h) * 0.22));
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    // Top-left
    ctx.moveTo(x, y + cornerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen, y);
    // Top-right
    ctx.moveTo(x + w - cornerLen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + cornerLen);
    // Bottom-right
    ctx.moveTo(x + w, y + h - cornerLen);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - cornerLen, y + h);
    // Bottom-left
    ctx.moveTo(x + cornerLen, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + h - cornerLen);
    ctx.stroke();

    // Optional 68-point facial landmarks
    if (showLandmarks && face.landmarks && face.landmarks.length > 0) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      for (const pt of face.landmarks) {
        const px = mirrorHorizontal ? width - pt.x : pt.x;
        ctx.beginPath();
        ctx.arc(px, pt.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Label pill rendered directly on canvas with crisp contrast
    const confidencePct = `${(face.score * 100).toFixed(1)}%`;
    const labelText =
      recognitionActive && face.match
        ? `${face.match.name} · ${confidencePct}`
        : recognitionActive
          ? `Unidentified #${face.index} · ${confidencePct}`
          : `Face #${face.index} · ${confidencePct}`;

    ctx.font = '600 12px "JetBrains Mono", monospace';
    const textMetrics = ctx.measureText(labelText);
    const padX = 8;
    const labelW = textMetrics.width + padX * 2;
    const labelH = 22;
    const labelX = Math.max(4, Math.min(x, width - labelW - 4));
    const labelY = y - labelH - 4 >= 4 ? y - labelH - 4 : y + 4;

    ctx.fillStyle = 'rgba(8, 14, 26, 0.88)';
    ctx.fillRect(labelX, labelY, labelW, labelH);
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(labelX, labelY, labelW, labelH);

    ctx.fillStyle = '#F8FAFC';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, labelX + padX, labelY + labelH / 2);
  });
}

export function cropFaceThumbnail(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
  size = 112,
): string | undefined {
  try {
    const srcW =
      source instanceof HTMLVideoElement
        ? source.videoWidth
        : source instanceof HTMLImageElement
          ? source.naturalWidth
          : source.width;
    const srcH =
      source instanceof HTMLVideoElement
        ? source.videoHeight
        : source instanceof HTMLImageElement
          ? source.naturalHeight
          : source.height;

    if (!srcW || !srcH) return undefined;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const pad = Math.max(box.width, box.height) * 0.25;
    const sx = Math.max(0, box.x - pad);
    const sy = Math.max(0, box.y - pad);
    const ex = Math.min(srcW, box.x + box.width + pad);
    const ey = Math.min(srcH, box.y + box.height + pad);
    const sw = Math.max(1, ex - sx);
    const sh = Math.max(1, ey - sy);

    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return undefined;
  }
}
