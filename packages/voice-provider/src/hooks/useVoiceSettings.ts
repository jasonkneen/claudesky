import { useEffect, useState } from 'react';

import type { VoiceSettings } from '../types';

const VOICE_SETTINGS_KEY = 'voice_settings';

const DEFAULT_SETTINGS: VoiceSettings = {
  provider: 'gemini',
  enabled: true,
  geminiApiKey: '',
  autoSubmit: true,
  voice: 'Zephyr'
};

export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings on mount - use IPC for API key, localStorage for others
  useEffect(() => {
    const loadSettings = async () => {
      // Load non-sensitive settings from localStorage
      const stored = localStorage.getItem(VOICE_SETTINGS_KEY);
      let loadedSettings = { ...DEFAULT_SETTINGS };
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          loadedSettings = { ...loadedSettings, ...parsed };
        } catch {
          // Use defaults if parsing fails
        }
      }

      // Load Gemini API key from main process (persistent storage)
      const electronApi = (window as any).electron;
      if (electronApi?.config?.getGeminiApiKey) {
        try {
          const result = await electronApi.config.getGeminiApiKey();
          if (result.geminiApiKey) {
            loadedSettings.geminiApiKey = result.geminiApiKey;
          }
        } catch (err) {
          console.error('[VoiceSettings] Failed to load Gemini API key:', err);
        }
      }

      setSettings(loadedSettings);
      setIsLoaded(true);
    };

    loadSettings();
  }, []);

  const updateSettings = async (updates: Partial<VoiceSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    // Save non-sensitive settings to localStorage
    const localStorageSettings = { ...newSettings };
    delete (localStorageSettings as any).geminiApiKey; // Don't store API key in localStorage
    localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(localStorageSettings));

    // Save Gemini API key to main process (persistent storage)
    if ('geminiApiKey' in updates) {
      const electronApi = (window as any).electron;
      if (electronApi?.config?.setGeminiApiKey) {
        try {
          await electronApi.config.setGeminiApiKey(updates.geminiApiKey || null);
        } catch (err) {
          console.error('[VoiceSettings] Failed to save Gemini API key:', err);
        }
      }
    }
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(VOICE_SETTINGS_KEY);

    // Clear Gemini API key in main process
    const electronApi = (window as any).electron;
    if (electronApi?.config?.setGeminiApiKey) {
      try {
        await electronApi.config.setGeminiApiKey(null);
      } catch (err) {
        console.error('[VoiceSettings] Failed to clear Gemini API key:', err);
      }
    }
  };

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoaded
  };
}
