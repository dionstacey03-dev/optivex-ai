import React, { useCallback, useEffect, useState } from 'react';
import { WorkspaceShell } from './components/layout/WorkspaceShell';
import { AnalyticsView } from './components/views/AnalyticsView';
import { DashboardView } from './components/views/DashboardView';
import { FaceRecognitionView } from './components/views/FaceRecognitionView';
import { HistoryView } from './components/views/HistoryView';
import { ImageAnalysisView } from './components/views/ImageAnalysisView';
import { LandingPage } from './components/views/LandingPage';
import { LiveDetectionView } from './components/views/LiveDetectionView';
import { SettingsView } from './components/views/SettingsView';
import { DEFAULT_SETTINGS, localVisionRepository } from './services/storageService';
import { ensureVisionModelsLoaded, getModelLoadState } from './services/visionEngine';
import type {
  AppView,
  AuthorizedProfile,
  DetectionSessionRecord,
  ModelLoadState,
  VisionSettings,
  WorkspaceSection,
} from './types/vision';

const VALID_SECTIONS: WorkspaceSection[] = [
  'dashboard',
  'live',
  'image',
  'recognition',
  'history',
  'analytics',
  'settings',
];

function getInitialView(): AppView {
  if (typeof window === 'undefined') return 'landing';
  const hash = window.location.hash.replace('#', '') as AppView;
  if (VALID_SECTIONS.includes(hash as WorkspaceSection)) {
    return hash;
  }
  return 'landing';
}

export default function App() {
  const [view, setView] = useState<AppView>(getInitialView);
  const [settings, setSettings] = useState<VisionSettings>(() =>
    localVisionRepository.getSettings(),
  );
  const [sessions, setSessions] = useState<DetectionSessionRecord[]>(() =>
    localVisionRepository.getSessions(),
  );
  const [profiles, setProfiles] = useState<AuthorizedProfile[]>(() =>
    localVisionRepository.getAuthorizedProfiles(),
  );
  const [modelState, setModelState] = useState<ModelLoadState>(() => getModelLoadState());

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '') as AppView;
      if (VALID_SECTIONS.includes(hash as WorkspaceSection)) {
        setView(hash);
      } else if (!hash) {
        setView('landing');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateTo = useCallback((nextView: AppView) => {
    setView(nextView);
    if (typeof window !== 'undefined') {
      const targetHash = nextView === 'landing' ? '' : `#${nextView}`;
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash || window.location.pathname);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleLoadModels = useCallback(() => {
    void ensureVisionModelsLoaded({
      includeRecognition: true,
      onStateChange: setModelState,
    }).catch(() => {
      // Error state is handled via onStateChange
    });
  }, []);

  const handleUpdateSettings = useCallback((next: VisionSettings) => {
    setSettings(next);
    localVisionRepository.saveSettings(next);
  }, []);

  const handleSessionSaved = useCallback((session: DetectionSessionRecord) => {
    const updated = localVisionRepository.addSession(session);
    setSessions(updated);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    const updated = localVisionRepository.deleteSession(id);
    setSessions(updated);
  }, []);

  const handleClearSessions = useCallback(() => {
    localVisionRepository.clearSessions();
    setSessions([]);
  }, []);

  const handleAddProfile = useCallback((profile: AuthorizedProfile) => {
    const updated = localVisionRepository.addAuthorizedProfile(profile);
    setProfiles(updated);
  }, []);

  const handleDeleteProfile = useCallback((id: string) => {
    const updated = localVisionRepository.deleteAuthorizedProfile(id);
    setProfiles(updated);
  }, []);

  const handleClearProfiles = useCallback(() => {
    localVisionRepository.clearAuthorizedProfiles();
    setProfiles([]);
  }, []);

  const handleFactoryReset = useCallback(() => {
    localVisionRepository.clearAllData();
    setSettings(DEFAULT_SETTINGS);
    setSessions([]);
    setProfiles([]);
  }, []);

  if (view === 'landing') {
    return (
      <LandingPage
        onEnterWorkspace={(section = 'dashboard') => {
          navigateTo(section);
        }}
      />
    );
  }

  return (
    <WorkspaceShell
      activeSection={view}
      onSelectSection={(sec) => navigateTo(sec)}
      onExitToLanding={() => navigateTo('landing')}
      modelState={modelState}
      onLoadModels={handleLoadModels}
      recognitionEnabled={settings.recognitionEnabled}
      authorizedCount={profiles.length}
    >
      {view === 'dashboard' ? (
        <DashboardView
          sessions={sessions}
          profiles={profiles}
          settings={settings}
          onNavigate={(sec) => navigateTo(sec)}
        />
      ) : null}

      {view === 'live' ? (
        <LiveDetectionView
          settings={settings}
          authorizedProfiles={profiles}
          modelState={modelState}
          onModelStateChange={setModelState}
          onSessionSaved={handleSessionSaved}
          onOpenRecognition={() => navigateTo('recognition')}
        />
      ) : null}

      {view === 'image' ? (
        <ImageAnalysisView
          settings={settings}
          authorizedProfiles={profiles}
          modelState={modelState}
          onModelStateChange={setModelState}
          onSessionSaved={handleSessionSaved}
        />
      ) : null}

      {view === 'recognition' ? (
        <FaceRecognitionView
          profiles={profiles}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onAddProfile={handleAddProfile}
          onDeleteProfile={handleDeleteProfile}
          onModelStateChange={setModelState}
        />
      ) : null}

      {view === 'history' ? (
        <HistoryView
          sessions={sessions}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearSessions}
          onNavigate={(sec) => navigateTo(sec)}
        />
      ) : null}

      {view === 'analytics' ? (
        <AnalyticsView sessions={sessions} onNavigate={(sec) => navigateTo(sec)} />
      ) : null}

      {view === 'settings' ? (
        <SettingsView
          settings={settings}
          sessions={sessions}
          profiles={profiles}
          onUpdateSettings={handleUpdateSettings}
          onClearSessions={handleClearSessions}
          onClearProfiles={handleClearProfiles}
          onFactoryReset={handleFactoryReset}
        />
      ) : null}
    </WorkspaceShell>
  );
}
