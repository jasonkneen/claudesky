import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { join } from 'path';
import { Worker } from 'worker_threads';

import type {
  EnhancePromptPayload,
  EnhancePromptResult,
  SubagentPayload,
  SubagentResult,
  WorkerInfo,
  WorkerProgress,
  WorkerResult,
  WorkerTask,
  WorkerTaskType,
  WorkerToMainMessage
} from '../../shared/types/worker';
import { TASK_TYPE_LABELS } from '../../shared/types/worker';

// Type mapping for task types to their payload/result types
type TaskPayloadMap = {
  'enhance-prompt': EnhancePromptPayload;
  subagent: SubagentPayload;
};

type TaskResultMap = {
  'enhance-prompt': EnhancePromptResult;
  subagent: SubagentResult;
};

// Default timeout for worker tasks (30 seconds)
const DEFAULT_TIMEOUT = 30000;

interface TrackedWorker {
  worker: Worker;
  info: WorkerInfo;
  timeoutId: NodeJS.Timeout | null;
  resolve: (result: WorkerResult) => void;
}

class WorkerManager extends EventEmitter {
  private workerScriptPath: string;
  private workers: Map<string, TrackedWorker> = new Map();

  constructor() {
    super();
    // Worker script path - will be in the same output directory as main process
    // After bundling: out/main/worker.js
    this.workerScriptPath = join(__dirname, 'worker.js');
  }

  /**
   * Get list of all tracked workers
   */
  getWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values()).map((tw) => tw.info);
  }

  /**
   * Get a specific worker's info
   */
  getWorker(workerId: string): WorkerInfo | null {
    const tracked = this.workers.get(workerId);
    return tracked ? tracked.info : null;
  }

  /**
   * Kill a specific worker
   */
  async killWorker(workerId: string): Promise<boolean> {
    const tracked = this.workers.get(workerId);
    if (!tracked) {
      return false;
    }

    // Clear timeout
    if (tracked.timeoutId) {
      clearTimeout(tracked.timeoutId);
    }

    // Update status
    tracked.info.status = 'cancelled';
    this.emitUpdate();

    // Terminate worker
    try {
      await tracked.worker.terminate();
    } catch {
      // Ignore termination errors
    }

    // Resolve with cancelled result
    tracked.resolve({
      id: workerId,
      success: false,
      error: 'Worker was cancelled'
    });

    // Remove from tracking
    this.workers.delete(workerId);
    this.emitUpdate();

    return true;
  }

  /**
   * Kill all workers
   */
  async killAll(): Promise<void> {
    const workerIds = Array.from(this.workers.keys());
    await Promise.all(workerIds.map((id) => this.killWorker(id)));
  }

  /**
   * Run a task in a worker thread
   */
  async runTask<T extends WorkerTaskType>(
    type: T,
    payload: TaskPayloadMap[T],
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<WorkerResult<TaskResultMap[T]>> {
    const taskId = randomUUID();

    const task: WorkerTask<TaskPayloadMap[T]> = {
      id: taskId,
      type,
      payload
    };

    // Create worker info for tracking
    const workerInfo: WorkerInfo = {
      id: taskId,
      type,
      status: 'pending',
      label: TASK_TYPE_LABELS[type] || type,
      startedAt: Date.now(),
      streamContent: ''
    };

    return new Promise((resolve) => {
      let timeoutId: NodeJS.Timeout | null = null;
      let worker: Worker | null = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.workers.delete(taskId);
        this.emitUpdate();
      };

      const handleComplete = (result: WorkerResult<TaskResultMap[T]>) => {
        cleanup();
        if (worker) {
          worker.terminate().catch(() => {});
          worker = null;
        }
        resolve(result);
      };

      try {
        console.log('[WorkerManager] Creating worker from:', this.workerScriptPath);
        worker = new Worker(this.workerScriptPath);

        // Track this worker
        const tracked: TrackedWorker = {
          worker,
          info: workerInfo,
          timeoutId: null,
          resolve: handleComplete as (result: WorkerResult) => void
        };
        this.workers.set(taskId, tracked);

        // Update status to running
        workerInfo.status = 'running';
        this.emitUpdate();

        // Set up timeout
        timeoutId = setTimeout(() => {
          workerInfo.status = 'failed';
          workerInfo.error = `Task timed out after ${timeout}ms`;
          handleComplete({
            id: taskId,
            success: false,
            error: `Task timed out after ${timeout}ms`
          });
        }, timeout);
        tracked.timeoutId = timeoutId;

        // Handle worker messages
        worker.on('message', (message: WorkerToMainMessage<TaskResultMap[T]>) => {
          // Check if this is a progress message
          if ('type' in message && message.type === 'progress') {
            const progress = message as WorkerProgress;
            workerInfo.progress = progress.text;
            if (progress.streamDelta) {
              workerInfo.streamContent = (workerInfo.streamContent || '') + progress.streamDelta;
              this.emit('stream', { workerId: taskId, delta: progress.streamDelta });
            }
            this.emitUpdate();
            return;
          }

          // It's a result message
          const result = message as WorkerResult<TaskResultMap[T]>;
          workerInfo.status = result.success ? 'completed' : 'failed';
          if (result.error) {
            workerInfo.error = result.error;
          }
          handleComplete(result);
        });

        // Handle worker errors
        worker.on('error', (error: Error) => {
          workerInfo.status = 'failed';
          workerInfo.error = error.message;
          handleComplete({
            id: taskId,
            success: false,
            error: error.message
          });
        });

        // Handle worker exit
        worker.on('exit', (code: number) => {
          if (code !== 0 && this.workers.has(taskId)) {
            workerInfo.status = 'failed';
            workerInfo.error = `Worker exited with code ${code}`;
            handleComplete({
              id: taskId,
              success: false,
              error: `Worker exited with code ${code}`
            });
          }
        });

        // Send task to worker
        worker.postMessage(task);
      } catch (error) {
        workerInfo.status = 'failed';
        workerInfo.error = error instanceof Error ? error.message : 'Failed to create worker';
        handleComplete({
          id: taskId,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create worker'
        });
      }
    });
  }

  /**
   * Emit worker list update event
   */
  private emitUpdate(): void {
    this.emit('update', { workers: this.getWorkers() });
  }
}

// Export singleton instance
export const workerManager = new WorkerManager();
