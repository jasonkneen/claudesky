/**
 * Split Handlers
 *
 * IPC handlers for split tab functionality.
 */

import { BrowserWindow, ipcMain } from 'electron';

import type { SplitTree } from '../../shared/types/splits';
import { deleteWindowState, loadSplitState, saveSplitState } from '../lib/split-state';

export function registerSplitHandlers(): void {
  // Get window ID for renderer to identify itself
  ipcMain.handle('window:get-id', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const windowId = window?.id.toString() || 'unknown';
    return { windowId };
  });

  // Load split tree for window
  ipcMain.handle('splits:load', async (event, windowId: string) => {
    try {
      const tree = loadSplitState(windowId);
      return { success: true, tree };
    } catch (error) {
      console.error('[splits:load] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        tree: null
      };
    }
  });

  // Save split tree for window
  ipcMain.handle('splits:save', async (event, windowId: string, tree: SplitTree) => {
    try {
      saveSplitState(windowId, tree);
      return { success: true };
    } catch (error) {
      console.error('[splits:save] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Delete window state (on window close)
  ipcMain.handle('splits:delete', async (event, windowId: string) => {
    try {
      deleteWindowState(windowId);
      return { success: true };
    } catch (error) {
      console.error('[splits:delete] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
}
