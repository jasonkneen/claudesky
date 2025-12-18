import { readdirSync } from 'fs';
import { join, relative } from 'path';
import { ipcMain } from 'electron';

interface FileItem {
  path: string;
  name: string;
  isDirectory: boolean;
}

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  '.next',
  '.claude',
  '.vscode',
  '.idea'
]);
const MAX_DEPTH = 3;

function getWorkspaceFilesRecursive(
  baseDir: string,
  maxDepth: number = MAX_DEPTH,
  currentDepth: number = 0,
  ignoreDirs: Set<string> = IGNORE_DIRS
): FileItem[] {
  const files: FileItem[] = [];

  try {
    const entries = readdirSync(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip ignored directories
      if (entry.isDirectory() && ignoreDirs.has(entry.name)) {
        continue;
      }

      const fullPath = join(baseDir, entry.name);
      const relativePath = relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        files.push({
          path: relativePath,
          name: entry.name,
          isDirectory: true
        });

        // Recurse into subdirectories if we haven't hit max depth
        if (currentDepth < maxDepth) {
          const subFiles = getWorkspaceFilesRecursive(
            fullPath,
            maxDepth,
            currentDepth + 1,
            ignoreDirs
          );
          files.push(...subFiles);
        }
      } else {
        files.push({
          path: relativePath,
          name: entry.name,
          isDirectory: false
        });
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${baseDir}:`, error);
  }

  return files;
}

export function registerFileHandlers(): void {
  // Get workspace files recursively
  ipcMain.handle('files:get-workspace-files', async (_event, baseDir: string) => {
    if (!baseDir || typeof baseDir !== 'string') {
      return { success: false, error: 'Invalid base directory', files: [] };
    }

    try {
      const files = getWorkspaceFilesRecursive(baseDir);
      return { success: true, files };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message, files: [] };
    }
  });
}
