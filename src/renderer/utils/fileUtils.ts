import type { FileItem } from '../electron';

/**
 * File system utilities for getting workspace files
 */

const FILE_CACHE = new Map<string, { items: FileItem[]; timestamp: number }>();
const CACHE_DURATION = 5000; // 5 seconds

/**
 * Get files from workspace directory
 * Uses IPC to access filesystem from main process
 */
export async function getWorkspaceFiles(baseDir: string): Promise<FileItem[]> {
  const now = Date.now();
  const cached = FILE_CACHE.get(baseDir);

  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.items;
  }

  try {
    const result = await window.electron?.files?.getWorkspaceFiles?.(baseDir);
    if (result?.success && result?.files) {
      FILE_CACHE.set(baseDir, { items: result.files, timestamp: now });
      return result.files;
    }
    if (!result?.success) {
      console.error('Failed to get workspace files:', result?.error);
    }
  } catch (error) {
    console.error('Failed to get workspace files:', error);
  }

  return [];
}

/**
 * Get files recursively with depth limit
 */
export async function getWorkspaceFilesRecursive(
  baseDir: string,
  maxDepth: number = 3,
  currentDepth: number = 0,
  ignoreDirs: Set<string> = new Set(['node_modules', '.git', 'dist', 'out', '.next'])
): Promise<FileItem[]> {
  if (currentDepth >= maxDepth) return [];

  const files = await getWorkspaceFiles(baseDir);
  let results: FileItem[] = [];

  for (const file of files) {
    // Skip ignored directories
    if (file.isDirectory && ignoreDirs.has(file.name)) {
      continue;
    }

    // Add all files and directories
    results.push(file);

    // Recursively get subdirectory contents
    if (file.isDirectory) {
      // Construct full path: baseDir + file.path
      const fullPath =
        baseDir.endsWith('/') || baseDir.endsWith('\\') ?
          baseDir + file.path
        : baseDir + '/' + file.path;

      const subFiles = await getWorkspaceFilesRecursive(
        fullPath,
        maxDepth,
        currentDepth + 1,
        ignoreDirs
      );
      results = results.concat(subFiles);
    }
  }

  return results;
}

/**
 * Get relative path for display
 */
export function getRelativePath(fullPath: string, baseDir: string): string {
  if (fullPath.startsWith(baseDir)) {
    return fullPath.slice(baseDir.length).replace(/^[/\\]/, '');
  }
  return fullPath;
}
