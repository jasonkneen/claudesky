/**
 * Split State Persistence
 *
 * Manages saving and loading split tree state for windows.
 * Storage: ~/Library/Application Support/Claudesky/window-splits.json
 */

import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import type { PersistedWindowState, SplitTree } from '../../shared/types/splits';
import { deserializeSplitTree, serializeSplitTree } from '../../shared/utils/split-utils';

interface SplitStateStorage {
  version: 1;
  windows: Record<string, PersistedWindowState>;
}

function getSplitStatePath(): string {
  return join(app.getPath('userData'), 'window-splits.json');
}

/**
 * Load all window split states from disk
 */
function loadAllStates(): SplitStateStorage {
  try {
    const statePath = getSplitStatePath();
    if (existsSync(statePath)) {
      const data = readFileSync(statePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[split-state] Failed to load split states:', error);
  }

  return {
    version: 1,
    windows: {}
  };
}

/**
 * Save all window split states to disk
 */
function saveAllStates(storage: SplitStateStorage): void {
  try {
    writeFileSync(getSplitStatePath(), JSON.stringify(storage, null, 2));
  } catch (error) {
    console.error('[split-state] Failed to save split states:', error);
  }
}

/**
 * Load split tree for a specific window
 *
 * @param windowId Window identifier
 * @returns Split tree or null if not found/invalid
 */
export function loadSplitState(windowId: string): SplitTree | null {
  try {
    const storage = loadAllStates();
    const windowState = storage.windows[windowId];

    if (!windowState) {
      console.log(`[split-state] No saved state for window ${windowId}`);
      return null;
    }

    // Validate by deserializing
    const treeJson = serializeSplitTree(windowState.splitTree);
    const validated = deserializeSplitTree(treeJson);

    console.log(
      `[split-state] Loaded split state for window ${windowId}: ${validated.root.kind === 'leaf' ? 'single pane' : 'split layout'}`
    );
    return validated;
  } catch (error) {
    console.error(`[split-state] Failed to load/validate state for window ${windowId}:`, error);
    return null;
  }
}

/**
 * Save split tree for a specific window
 *
 * @param windowId Window identifier
 * @param tree Split tree to save
 */
export function saveSplitState(windowId: string, tree: SplitTree): void {
  try {
    const storage = loadAllStates();

    storage.windows[windowId] = {
      windowId,
      splitTree: tree,
      lastModified: Date.now()
    };

    saveAllStates(storage);
    console.log(`[split-state] Saved split state for window ${windowId}`);
  } catch (error) {
    console.error(`[split-state] Failed to save state for window ${windowId}:`, error);
  }
}

/**
 * Delete split state for a window
 *
 * @param windowId Window identifier
 */
export function deleteWindowState(windowId: string): void {
  try {
    const storage = loadAllStates();
    delete storage.windows[windowId];
    saveAllStates(storage);
    console.log(`[split-state] Deleted state for window ${windowId}`);
  } catch (error) {
    console.error(`[split-state] Failed to delete state for window ${windowId}:`, error);
  }
}

/**
 * Clean up old window states (not accessed in 30 days)
 */
export function cleanupOldStates(): void {
  try {
    const storage = loadAllStates();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [windowId, state] of Object.entries(storage.windows)) {
      if (state.lastModified < thirtyDaysAgo) {
        delete storage.windows[windowId];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      saveAllStates(storage);
      console.log(`[split-state] Cleaned up ${cleaned} old window states`);
    }
  } catch (error) {
    console.error('[split-state] Failed to cleanup old states:', error);
  }
}
