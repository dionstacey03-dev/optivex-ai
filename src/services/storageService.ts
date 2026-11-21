import type {
  AuthorizedProfile,
  DetectionSessionRecord,
  ExportBundle,
  VisionSettings,
} from '../types/vision';

const STORAGE_KEYS = {
  SETTINGS: 'optivex_ai_settings_v1',
  SESSIONS: 'optivex_ai_sessions_v1',
  PROFILES: 'optivex_ai_profiles_v1',
} as const;

export const DEFAULT_SETTINGS: VisionSettings = {
  detectorModel: 'tiny',
  confidenceThreshold: 0.5,
  inputSize: 416,
  showLandmarks: true,
  recognitionEnabled: false,
  matchThreshold: 0.52,
  saveSessionHistory: true,
  mirrorWebcam: true,
};

// In-memory fallback when browser blocks localStorage (e.g. restricted iframes / private mode)
const memoryFallback = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  memoryFallback.set(key, value);
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string): void {
  memoryFallback.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage access restriction
  }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export interface VisionRepository {
  getSettings(): VisionSettings;
  saveSettings(settings: VisionSettings): void;
  getSessions(): DetectionSessionRecord[];
  addSession(session: DetectionSessionRecord): DetectionSessionRecord[];
  deleteSession(id: string): DetectionSessionRecord[];
  clearSessions(): void;
  getAuthorizedProfiles(): AuthorizedProfile[];
  addAuthorizedProfile(profile: AuthorizedProfile): AuthorizedProfile[];
  deleteAuthorizedProfile(id: string): AuthorizedProfile[];
  clearAuthorizedProfiles(): void;
  exportAllData(): ExportBundle;
  clearAllData(): void;
  getApproximateStorageBytes(): number;
}

export const localVisionRepository: VisionRepository = {
  getSettings(): VisionSettings {
    const parsed = safeParse<Partial<VisionSettings>>(
      safeGetItem(STORAGE_KEYS.SETTINGS),
      {},
    );
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  },

  saveSettings(settings: VisionSettings): void {
    safeSetItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getSessions(): DetectionSessionRecord[] {
    const list = safeParse<DetectionSessionRecord[]>(
      safeGetItem(STORAGE_KEYS.SESSIONS),
      [],
    );
    return Array.isArray(list) ? list : [];
  },

  addSession(session: DetectionSessionRecord): DetectionSessionRecord[] {
    const current = this.getSessions();
    const updated = [session, ...current].slice(0, 500);
    safeSetItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));
    return updated;
  },

  deleteSession(id: string): DetectionSessionRecord[] {
    const updated = this.getSessions().filter((item) => item.id !== id);
    safeSetItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));
    return updated;
  },

  clearSessions(): void {
    safeRemoveItem(STORAGE_KEYS.SESSIONS);
  },

  getAuthorizedProfiles(): AuthorizedProfile[] {
    const list = safeParse<AuthorizedProfile[]>(
      safeGetItem(STORAGE_KEYS.PROFILES),
      [],
    );
    return Array.isArray(list) ? list : [];
  },

  addAuthorizedProfile(profile: AuthorizedProfile): AuthorizedProfile[] {
    const current = this.getAuthorizedProfiles();
    const updated = [profile, ...current];
    const saved = safeSetItem(STORAGE_KEYS.PROFILES, JSON.stringify(updated));
    if (!saved && profile.previewDataUrl) {
      // Retry without thumbnail if storage quota is tight
      const compactProfile: AuthorizedProfile = { ...profile, previewDataUrl: undefined };
      const compactList = [compactProfile, ...current];
      safeSetItem(STORAGE_KEYS.PROFILES, JSON.stringify(compactList));
      return compactList;
    }
    return updated;
  },

  deleteAuthorizedProfile(id: string): AuthorizedProfile[] {
    const updated = this.getAuthorizedProfiles().filter((p) => p.id !== id);
    safeSetItem(STORAGE_KEYS.PROFILES, JSON.stringify(updated));
    return updated;
  },

  clearAuthorizedProfiles(): void {
    safeRemoveItem(STORAGE_KEYS.PROFILES);
  },

  exportAllData(): ExportBundle {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      sessions: this.getSessions(),
      authorizedProfiles: this.getAuthorizedProfiles(),
    };
  },

  clearAllData(): void {
    safeRemoveItem(STORAGE_KEYS.SETTINGS);
    safeRemoveItem(STORAGE_KEYS.SESSIONS);
    safeRemoveItem(STORAGE_KEYS.PROFILES);
  },

  getApproximateStorageBytes(): number {
    let total = 0;
    for (const key of Object.values(STORAGE_KEYS)) {
      const val = safeGetItem(key);
      if (val) {
        total += new Blob([val]).size;
      }
    }
    return total;
  },
};
