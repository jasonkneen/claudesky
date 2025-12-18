import { ipcMain } from 'electron';

import {
  addRecentUrl,
  clearRecentUrls,
  getRecentUrls,
  removeRecentUrl,
  type RecentUrl
} from '../lib/config';

export function registerBrowserHandlers(): void {
  // Get recent URLs list
  ipcMain.handle('browser:get-recent-urls', async (): Promise<{ urls: RecentUrl[] }> => {
    try {
      const urls = getRecentUrls();
      return { urls };
    } catch (error) {
      console.error('Failed to get recent URLs:', error);
      return { urls: [] };
    }
  });

  // Add a URL to recent history
  ipcMain.handle(
    'browser:add-recent-url',
    async (_event, url: string, title?: string): Promise<{ success: boolean }> => {
      try {
        addRecentUrl(url, title);
        return { success: true };
      } catch (error) {
        console.error('Failed to add recent URL:', error);
        return { success: false };
      }
    }
  );

  // Remove a URL from recent history
  ipcMain.handle(
    'browser:remove-recent-url',
    async (_event, url: string): Promise<{ success: boolean }> => {
      try {
        removeRecentUrl(url);
        return { success: true };
      } catch (error) {
        console.error('Failed to remove recent URL:', error);
        return { success: false };
      }
    }
  );

  // Clear all recent URLs
  ipcMain.handle('browser:clear-recent-urls', async (): Promise<{ success: boolean }> => {
    try {
      clearRecentUrls();
      return { success: true };
    } catch (error) {
      console.error('Failed to clear recent URLs:', error);
      return { success: false };
    }
  });
}
