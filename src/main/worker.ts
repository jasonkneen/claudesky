/**
 * Base worker script that runs inside worker_threads
 * Routes tasks to appropriate handlers based on task type
 */
import { parentPort } from 'worker_threads';

import type {
  EnhancePromptPayload,
  EnhancePromptResult,
  WorkerResult,
  WorkerTask
} from '../shared/types/worker';
import { handleEnhancePrompt } from './workers/tasks/enhance-prompt';

if (!parentPort) {
  throw new Error('This script must be run as a worker thread');
}

// Listen for tasks from the main thread
parentPort.on('message', async (task: WorkerTask) => {
  let result: WorkerResult;

  try {
    switch (task.type) {
      case 'enhance-prompt': {
        const payload = task.payload as EnhancePromptPayload;
        const data = await handleEnhancePrompt(payload);
        result = {
          id: task.id,
          success: true,
          data: data as EnhancePromptResult
        };
        break;
      }

      case 'subagent': {
        // Future implementation
        result = {
          id: task.id,
          success: false,
          error: 'Subagent tasks not yet implemented'
        };
        break;
      }

      default: {
        result = {
          id: task.id,
          success: false,
          error: `Unknown task type: ${(task as WorkerTask).type}`
        };
      }
    }
  } catch (error) {
    result = {
      id: task.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in worker'
    };
  }

  // Send result back to main thread
  parentPort!.postMessage(result);
});
