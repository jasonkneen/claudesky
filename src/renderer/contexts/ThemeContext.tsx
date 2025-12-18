import React, { createContext, useContext, useEffect, useState } from 'react';

import type { AppTheme } from '../../shared/themes';
import { APP_THEMES, applyThemeToDocument, DEFAULT_THEME_ID, getTheme } from '../../shared/themes';

interface ThemeContextType {
  currentTheme: AppTheme;
  setTheme: (themeId: string) => void;
  themes: AppTheme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    const savedThemeId = localStorage.getItem('app-theme-id');
    return getTheme(savedThemeId || DEFAULT_THEME_ID);
  });

  const setTheme = (themeId: string) => {
    const theme = getTheme(themeId);
    console.log('[ThemeContext] Switching to theme:', themeId, theme);
    setCurrentTheme(theme);
    localStorage.setItem('app-theme-id', themeId);
    applyThemeToDocument(theme);
    console.log(
      '[ThemeContext] Theme applied. data-theme:',
      document.documentElement.getAttribute('data-theme')
    );

    // Sync native macOS theme for native tab bar coloring
    if (window.electron?.theme?.set) {
      // Determine if theme is dark based on theme properties or document class
      const isDark = theme.isDark ?? document.documentElement.classList.contains('dark');
      window.electron.theme.set(isDark ? 'dark' : 'light').catch((err) => {
        console.error('[ThemeContext] Failed to set native theme:', err);
      });
    }
  };

  // Apply theme on mount and whenever currentTheme changes
  useEffect(() => {
    applyThemeToDocument(currentTheme);

    // Sync native macOS theme on mount for native tab bar coloring
    if (window.electron?.theme?.set) {
      const isDark = currentTheme.isDark ?? document.documentElement.classList.contains('dark');
      window.electron.theme.set(isDark ? 'dark' : 'light').catch((err) => {
        console.error('[ThemeContext] Failed to set native theme on mount:', err);
      });
    }
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes: APP_THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
