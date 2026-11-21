import type { VisionEffectMode } from '../types/vision';

export interface VisionEffectOption {
  id: VisionEffectMode;
  label: string;
  shortDesc: string;
}

export const VISION_EFFECT_OPTIONS: VisionEffectOption[] = [
  {
    id: 'standard',
    label: 'Standard',
    shortDesc: 'Full-color camera input',
  },
  {
    id: 'grayscale',
    label: 'Grayscale',
    shortDesc: 'Contrast-normalized luminance',
  },
  {
    id: 'edge',
    label: 'Edge Overlay',
    shortDesc: 'Sobel contour & contrast boost',
  },
];

const MAX_EFFECT_PROCESS_WIDTH = 640;

/**
 * Renders the selected computer vision contrast filter ('grayscale' or 'edge')
 * onto `displayCanvas` at native video resolution, using `workCanvas` for fast
 * downsampled pixel convolution.
 *
 * When `aiInputCanvas` is provided in `'edge'` mode, it populates a lightly
 * edge-sharpened luminance frame so neural face detectors retain full shading
 * features while benefiting from boosted boundary contrast.
 */
export function renderVisionEffectFrame(
  video: HTMLVideoElement,
  displayCanvas: HTMLCanvasElement,
  workCanvas: HTMLCanvasElement,
  mode: VisionEffectMode,
  aiInputCanvas?: HTMLCanvasElement | null,
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  if (displayCanvas.width !== vw || displayCanvas.height !== vh) {
    displayCanvas.width = vw;
    displayCanvas.height = vh;
  }

  const displayCtx = displayCanvas.getContext('2d');
  if (!displayCtx) return;

  if (mode === 'standard') {
    displayCtx.clearRect(0, 0, vw, vh);
    return;
  }

  const scale = vw > MAX_EFFECT_PROCESS_WIDTH ? MAX_EFFECT_PROCESS_WIDTH / vw : 1;
  const pw = Math.max(2, Math.round(vw * scale));
  const ph = Math.max(2, Math.round(vh * scale));

  if (workCanvas.width !== pw || workCanvas.height !== ph) {
    workCanvas.width = pw;
    workCanvas.height = ph;
  }

  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!workCtx) return;

  workCtx.drawImage(video, 0, 0, pw, ph);
  const frame = workCtx.getImageData(0, 0, pw, ph);
  const data = frame.data;
  const pixelCount = pw * ph;

  // Compute ITU-R BT.601 luminance once
  const lum = new Uint8Array(pixelCount);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    lum[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  if (mode === 'grayscale') {
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      // Gentle linear contrast boost centered at mid-gray
      const contrasted = Math.max(0, Math.min(255, Math.round((lum[p] - 128) * 1.18 + 128)));
      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
      data[i + 3] = 255;
    }
    workCtx.putImageData(frame, 0, 0);
    displayCtx.drawImage(workCanvas, 0, 0, vw, vh);
    return;
  }

  // Sobel 3x3 edge-detection magnitude pass
  const mag = new Uint8Array(pixelCount);
  for (let y = 1; y < ph - 1; y += 1) {
    const rowOffset = y * pw;
    for (let x = 1; x < pw - 1; x += 1) {
      const idx = rowOffset + x;
      const p00 = lum[idx - pw - 1];
      const p01 = lum[idx - pw];
      const p02 = lum[idx - pw + 1];
      const p10 = lum[idx - 1];
      const p12 = lum[idx + 1];
      const p20 = lum[idx + pw - 1];
      const p21 = lum[idx + pw];
      const p22 = lum[idx + pw + 1];

      const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
      const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;
      const absG = Math.abs(gx) + Math.abs(gy);
      mag[idx] = absG > 255 ? 255 : absG;
    }
  }

  // Paint high-contrast Sobel cyan/silver edge-detection overlay to displayCanvas
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const base = lum[p] * 0.24;
    const edge = mag[p] > 24 ? mag[p] : 0;
    data[i] = Math.min(255, Math.round(base * 0.55 + edge * 0.16));
    data[i + 1] = Math.min(255, Math.round(base * 0.85 + edge * 0.88));
    data[i + 2] = Math.min(255, Math.round(base * 1.1 + edge));
    data[i + 3] = 255;
  }
  workCtx.putImageData(frame, 0, 0);
  displayCtx.drawImage(workCanvas, 0, 0, vw, vh);

  // Also render edge-sharpened contrast frame for AI engine input if requested
  if (aiInputCanvas) {
    if (aiInputCanvas.width !== vw || aiInputCanvas.height !== vh) {
      aiInputCanvas.width = vw;
      aiInputCanvas.height = vh;
    }
    const aiCtx = aiInputCanvas.getContext('2d');
    if (aiCtx) {
      const sharpData = new ImageData(pw, ph);
      const sd = sharpData.data;
      for (let i = 0, p = 0; i < sd.length; i += 4, p += 1) {
        const yVal = lum[p];
        const edgeBoost = mag[p] > 20 ? mag[p] * 0.25 : 0;
        const val = Math.max(0, Math.min(255, Math.round((yVal - 128) * 1.12 + 128 + edgeBoost)));
        sd[i] = val;
        sd[i + 1] = val;
        sd[i + 2] = val;
        sd[i + 3] = 255;
      }
      workCtx.putImageData(sharpData, 0, 0);
      aiCtx.drawImage(workCanvas, 0, 0, vw, vh);
    }
  }
}
