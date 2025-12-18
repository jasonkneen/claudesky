import { ipcMain, type BrowserWindow } from 'electron';

import type { WorkerInfo, WorkerListUpdate, WorkerStreamUpdate } from '../../shared/types/worker';
import { workerManager } from '../lib/worker-manager';

export function registerWorkerHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Set up event forwarding from WorkerManager to renderer
  workerManager.on('update', (data: WorkerListUpdate) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('worker:list-update', data);
    }
  });

  workerManager.on('stream', (data: WorkerStreamUpdate) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('worker:stream-update', data);
    }
  });

  // Get list of all workers
  ipcMain.handle('worker:list', async (): Promise<{ workers: WorkerInfo[] }> => {
    return { workers: workerManager.getWorkers() };
  });

  // Get a specific worker's info
  ipcMain.handle(
    'worker:get',
    async (_event, workerId: string): Promise<{ worker: WorkerInfo | null }> => {
      return { worker: workerManager.getWorker(workerId) };
    }
  );

  // Kill a specific worker
  ipcMain.handle('worker:kill', async (_event, workerId: string): Promise<{ success: boolean }> => {
    const success = await workerManager.killWorker(workerId);
    return { success };
  });

  // Kill all workers
  ipcMain.handle('worker:kill-all', async (): Promise<{ success: boolean }> => {
    await workerManager.killAll();
    return { success: true };
  });
}
