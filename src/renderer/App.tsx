import { useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';

import LoadingStatus, { type LoadingStep } from '@/components/LoadingStatus';
import ProjectPicker from '@/components/ProjectPicker';
import SplitLayout from '@/components/splits/SplitLayout';
import TitleBar from '@/components/TitleBar';
import UpdateCheckFeedback from '@/components/UpdateCheckFeedback';
import UpdateNotification from '@/components/UpdateNotification';
import UpdateReadyBanner from '@/components/UpdateReadyBanner';
import WorkerIndicator from '@/components/WorkerIndicator';
import { SplitProvider } from '@/contexts/SplitContext';
import Browser from '@/pages/Browser';
import Chat from '@/pages/Chat';
import Kanban from '@/pages/Kanban';
import Notes from '@/pages/Notes';
import Settings from '@/pages/Settings';
import Todos from '@/pages/Todos';

// Initial loading steps for project initialization
const INITIAL_LOADING_STEPS: LoadingStep[] = [
  { id: 'workspace', label: 'Loading workspace', status: 'pending' },
  { id: 'config', label: 'Reading configuration', status: 'pending' },
  { id: 'ready', label: 'Ready', status: 'pending' }
];

type TabType = 'project' | 'todos' | 'kanban' | 'notes' | 'picker' | 'browser' | 'home';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'settings'>('home');
  const currentViewRef = useRef<'home' | 'settings'>('home');
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>(INITIAL_LOADING_STEPS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Determine tab type from URL
  const tabType: TabType = window.electron?.tab?.getType?.() ?? 'home';
  const projectPath = window.electron?.project?.getFromUrl?.() ?? null;

  // Debug logging
  console.log('[App] ============ TAB DEBUG ============');
  console.log('[App] window.location.href:', window.location.href);
  console.log('[App] window.location.search:', window.location.search);
  console.log('[App] tabType from getType():', tabType);
  console.log('[App] projectPath from getFromUrl():', projectPath);
  console.log('[App] ===================================');

  useEffect(() => {
    // Update ref whenever currentView changes
    currentViewRef.current = currentView;
  }, [currentView]);

  useEffect(() => {
    // Listen for navigation events from main process
    const unsubscribeNavigate = window.electron.onNavigate((view: string) => {
      // If navigating to settings and already on settings, toggle back to home
      if (view === 'settings' && currentViewRef.current === 'settings') {
        setCurrentView('home');
      } else {
        setCurrentView(view as 'home' | 'settings');
      }
    });

    return () => {
      unsubscribeNavigate();
    };
  }, []);

  // Initialize project window
  useEffect(() => {
    if (tabType !== 'project') return;

    const initializeProject = async () => {
      // Step 1: Loading workspace
      setLoadingSteps((prev) =>
        prev.map((s) => (s.id === 'workspace' ? { ...s, status: 'loading' } : s))
      );

      // Simulate workspace loading (this would be real workspace setup)
      await new Promise((resolve) => setTimeout(resolve, 500));

      setLoadingSteps((prev) =>
        prev.map((s) =>
          s.id === 'workspace' ? { ...s, status: 'complete' }
          : s.id === 'config' ? { ...s, status: 'loading' }
          : s
        )
      );

      // Step 2: Reading configuration
      await new Promise((resolve) => setTimeout(resolve, 400));

      setLoadingSteps((prev) =>
        prev.map((s) =>
          s.id === 'config' ? { ...s, status: 'complete' }
          : s.id === 'ready' ? { ...s, status: 'loading' }
          : s
        )
      );

      // Step 3: Ready
      await new Promise((resolve) => setTimeout(resolve, 300));

      setLoadingSteps((prev) => prev.map((s) => ({ ...s, status: 'complete' })));

      // Mark as initialized
      setIsInitialized(true);
    };

    initializeProject();
  }, [tabType]);

  // Common wrapper with toasts and indicators
  const AppWrapper = ({ children }: { children: React.ReactNode }) => (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700'
        }}
      />
      <UpdateCheckFeedback />
      <UpdateNotification />
      <UpdateReadyBanner />
      <WorkerIndicator />
      <div className={currentView === 'settings' ? 'block' : 'hidden'}>
        <Settings onBack={() => setCurrentView('home')} />
      </div>
      <div className={currentView === 'home' ? 'block' : 'hidden'}>{children}</div>
    </>
  );

  const openSettings = () => setCurrentView('settings');

  // Route based on tab type
  // Split-capable tabs use SplitProvider + SplitLayout
  switch (tabType) {
    case 'project': {
      // Get project name from path
      const projectName = projectPath?.split('/').pop() || 'Project';

      return (
        <AppWrapper>
          {!isInitialized ?
            <div className="flex h-screen flex-col bg-white dark:bg-neutral-900">
              <TitleBar onOpenSettings={openSettings} projectName={projectName} />
              <div className="flex-1 overflow-auto pt-[48px]">
                <LoadingStatus steps={loadingSteps} title={`Opening ${projectName}...`} />
              </div>
            </div>
          : (() => {
              console.log('[App] SplitProvider initialContent.projectPath:', projectPath || undefined);
              return (
                <SplitProvider
                  initialContent={{ type: 'project', projectPath: projectPath || undefined }}
                  projectName={projectName}
                >
                  <SplitLayout />
                </SplitProvider>
              );
            })()}
        </AppWrapper>
      );
    }

    case 'todos':
      return (
        <AppWrapper>
          <SplitProvider initialContent={{ type: 'todos' }}>
            <SplitLayout />
          </SplitProvider>
        </AppWrapper>
      );

    case 'kanban':
      return (
        <AppWrapper>
          <SplitProvider initialContent={{ type: 'kanban' }}>
            <SplitLayout />
          </SplitProvider>
        </AppWrapper>
      );

    case 'notes':
      return (
        <AppWrapper>
          <SplitProvider initialContent={{ type: 'notes' }}>
            <SplitLayout />
          </SplitProvider>
        </AppWrapper>
      );

    case 'browser':
      return (
        <AppWrapper>
          <SplitProvider initialContent={{ type: 'browser' }}>
            <SplitLayout />
          </SplitProvider>
        </AppWrapper>
      );

    case 'picker':
      // New tab from "+" button shows browser with URL input
      return (
        <AppWrapper>
          <SplitProvider initialContent={{ type: 'browser' }}>
            <SplitLayout />
          </SplitProvider>
        </AppWrapper>
      );

    case 'home':
    default:
      // Home Window: Shows Project Picker
      return (
        <AppWrapper>
          <div className="flex h-screen flex-col bg-white dark:bg-neutral-900">
            <TitleBar onOpenSettings={openSettings} />
            <div className="flex-1 overflow-auto pt-[48px]">
              <ProjectPicker />
            </div>
          </div>
        </AppWrapper>
      );
  }
}
