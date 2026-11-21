export type AppView =
  | 'landing'
  | 'dashboard'
  | 'live'
  | 'image'
  | 'recognition'
  | 'history'
  | 'analytics'
  | 'settings';

export type WorkspaceSection = Exclude<AppView, 'landing'>;

export type DetectorModel = 'tiny' | 'ssd';

export type InputSizeOption = 224 | 320 | 416;

export type VisionEffectMode = 'standard' | 'grayscale' | 'edge';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface IdentityMatch {
  profileId: string;
  name: string;
  role: string;
  distance: number;
  similarity: number;
}

export interface DetectedFaceResult {
  id: string;
  index: number;
  box: BoundingBox;
  score: number;
  landmarks?: Point2D[];
  descriptor?: number[];
  match?: IdentityMatch | null;
}

export interface AuthorizedProfile {
  id: string;
  name: string;
  role: string;
  consentGrantedAt: string;
  consentStatement: string;
  descriptor: number[];
  previewDataUrl?: string;
}

export interface DetectionSessionRecord {
  id: string;
  timestamp: string;
  type: 'live' | 'image';
  sourceLabel: string;
  faceCount: number;
  peakFaceCount: number;
  avgConfidence: number;
  minConfidence: number;
  maxConfidence: number;
  durationMs: number;
  matchedNames: string[];
  modelUsed: DetectorModel;
  recognitionActive: boolean;
  notes?: string;
}

export interface VisionSettings {
  detectorModel: DetectorModel;
  confidenceThreshold: number;
  inputSize: InputSizeOption;
  showLandmarks: boolean;
  recognitionEnabled: boolean;
  matchThreshold: number;
  saveSessionHistory: boolean;
  mirrorWebcam: boolean;
}

export interface ModelLoadState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  loadedModels: string[];
  errorMessage?: string;
}

export interface ExportBundle {
  schemaVersion: number;
  exportedAt: string;
  settings: VisionSettings;
  sessions: DetectionSessionRecord[];
  authorizedProfiles: AuthorizedProfile[];
}
