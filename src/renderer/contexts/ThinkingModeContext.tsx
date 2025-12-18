import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import type { ThinkingMode } from '../../shared/types/ipc';

interface ThinkingModeContextType {
  thinkingMode: ThinkingMode;
  setThinkingMode: (mode: ThinkingMode) => void;
}

const ThinkingModeContext = createContext<ThinkingModeContextType | undefined>(undefined);

interface ThinkingModeProviderProps {
  children: ReactNode;
}

export function ThinkingModeProvider({ children }: ThinkingModeProviderProps) {
  const [thinkingMode, setThinkingModeState] = useState<ThinkingMode>('off');

  // Load thinking mode from electron on mount
  useEffect(() => {
    let isMounted = true;
    if (typeof window.electron.chat.getThinkingMode === 'function') {
      window.electron.chat
        .getThinkingMode()
        .then(({ mode }) => {
          if (isMounted && mode) {
            setThinkingModeState(mode);
          }
        })
        .catch((error: unknown) => {
          console.error('Error loading thinking mode:', error);
          toast.error('Failed to load thinking mode preference');
        });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const setThinkingMode = (mode: ThinkingMode) => {
    if (mode === thinkingMode) {
      return;
    }

    const previousMode = thinkingMode;
    setThinkingModeState(mode);

    if (typeof window.electron.chat.setThinkingMode !== 'function') {
      console.warn('setThinkingMode not available - restart app to apply preload changes');
      toast.warning('Thinking mode unavailable - restart app to enable');
      setThinkingModeState(previousMode);
      return;
    }

    window.electron.chat
      .setThinkingMode(mode)
      .then((response) => {
        if (!response.success) {
          console.error('Error updating thinking mode:', response.error);
          toast.error(response.error ?? 'Failed to change thinking mode');
          setThinkingModeState(response.mode ?? previousMode);
        } else if (response.mode) {
          setThinkingModeState(response.mode);
        }
      })
      .catch((error: unknown) => {
        console.error('Error updating thinking mode:', error);
        toast.error('Failed to change thinking mode');
        setThinkingModeState(previousMode);
      });
  };

  return (
    <ThinkingModeContext.Provider value={{ thinkingMode, setThinkingMode }}>
      {children}
    </ThinkingModeContext.Provider>
  );
}

export function useThinkingMode(): ThinkingModeContextType {
  const context = useContext(ThinkingModeContext);
  if (!context) {
    throw new Error('useThinkingMode must be used within ThinkingModeProvider');
  }
  return context;
}
