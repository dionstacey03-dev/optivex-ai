import React, { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Camera,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ModelLoadState, WorkspaceSection } from '../../types/vision';
import { OptivexLogo } from '../ui/Primitives';

interface WorkspaceShellProps {
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  onExitToLanding: () => void;
  modelState: ModelLoadState;
  onLoadModels: () => void;
  recognitionEnabled: boolean;
  authorizedCount: number;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: WorkspaceSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'live', label: 'Live Detection', icon: Camera },
  { id: 'image', label: 'Image Analysis', icon: ImageIcon },
  { id: 'recognition', label: 'Face Recognition', icon: ShieldCheck },
  { id: 'history', label: 'Detection History', icon: History },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function WorkspaceShell({
  activeSection,
  onSelectSection,
  onExitToLanding,
  modelState,
  onLoadModels,
  recognitionEnabled,
  authorizedCount,
  children,
}: WorkspaceShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeNav = NAV_ITEMS.find((item) => item.id === activeSection) ?? NAV_ITEMS[0];

  const handleSelect = (id: WorkspaceSection) => {
    onSelectSection(id);
    setMobileMenuOpen(false);
  };

  const renderSidebar = (isMobileDrawer: boolean) => (
    <div className="flex h-full flex-col justify-between bg-[#080E1A] p-4 glass-sidebar">
      <div>
        <div className="flex items-center justify-between px-2 py-2">
          <button
            type="button"
            onClick={onExitToLanding}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer"
          >
            <OptivexLogo />
          </button>
          {isMobileDrawer ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <nav
          aria-label={isMobileDrawer ? 'Mobile navigation' : 'Workspace navigation'}
          className="mt-6 space-y-1"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeSection;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`flex min-h-[42px] w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isActive
                    ? 'border border-cyan-300/15 bg-cyan-400/12 text-cyan-300 shadow-[inset_0_0_18px_rgba(34,211,238,0.05)]'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-50'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 border-t border-slate-800/80 pt-4">
        <div className="rounded-lg border border-slate-800/80 bg-[#0D1526] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Vision Models</span>
            <span
              className={`font-mono font-medium ${
                modelState.status === 'ready'
                  ? 'text-cyan-400'
                  : modelState.status === 'error'
                    ? 'text-rose-400'
                    : 'text-slate-300'
              }`}
            >
              {modelState.status === 'ready'
                ? 'Loaded'
                : modelState.status === 'loading'
                  ? 'Loading'
                  : modelState.status === 'error'
                    ? 'Error'
                    : 'Standby'}
            </span>
          </div>
          {modelState.status !== 'ready' ? (
            <button
              type="button"
              onClick={onLoadModels}
              disabled={modelState.status === 'loading'}
              className="mt-2.5 min-h-[36px] w-full rounded-md border border-slate-700 bg-[#121E36] px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-500 disabled:opacity-50 cursor-pointer"
            >
              {modelState.status === 'loading' ? 'Loading Weights…' : 'Preload Models'}
            </button>
          ) : (
            <div className="mt-1.5 text-[11px] text-slate-400">
              Recognition: {recognitionEnabled ? `Active (${authorizedCount})` : 'Detection Only'}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onExitToLanding}
          className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-slate-100 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          <span>Back to Overview</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#070C17] text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-[252px] shrink-0 border-r border-slate-800/80 lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">{renderSidebar(false)}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 border-r border-slate-800 bg-[#080E1A] glass-sidebar">
            {renderSidebar(true)}
          </aside>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-800/80 bg-[#070C17]/95 px-5 py-3.5 backdrop-blur-md glass-topbar lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-300 hover:bg-slate-800/70 lg:hidden cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
              <span className="text-slate-400">OPTIVEX AI</span>
              <span className="text-slate-600" aria-hidden="true">/</span>
              <span className="font-medium text-slate-100 truncate">{activeNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeSection !== 'live' ? (
              <button
                type="button"
                onClick={() => onSelectSection('live')}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                Live Detection
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectSection('image')}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1526] px-3.5 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:border-slate-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ImageIcon className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                Image Analysis
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
