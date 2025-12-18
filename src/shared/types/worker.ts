// Worker thread type definitions

export type WorkerTaskType = 'enhance-prompt' | 'subagent';

export type WorkerStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

// Worker info for UI display
export interface WorkerInfo {
  id: string;
  type: WorkerTaskType;
  status: WorkerStatus;
  label: string;
  startedAt: number;
  progress?: string; // Current progress text for display
  streamContent?: string; // Accumulated streaming content
  error?: string;
}

// Base task interface
export interface WorkerTask<T = unknown> {
  id: string;
  type: WorkerTaskType;
  payload: T;
}

// Base result interface
export interface WorkerResult<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

// Progress message from worker to main thread
export interface WorkerProgress {
  id: string;
  type: 'progress';
  text: string; // Progress text to display
  streamDelta?: string; // Streaming text delta
}

// Message types from worker to main
export type WorkerToMainMessage<T = unknown> = WorkerResult<T> | WorkerProgress;

// Enhance Prompt types
export interface EnhancePromptPayload {
  prompt: string;
  env: Record<string, string>;
}

export interface EnhancePromptResult {
  enhancedPrompt: string;
}

// Subagent types (for future use)
export interface SubagentPayload {
  task: string;
  context?: string;
  env: Record<string, string>;
}

export interface SubagentResult {
  response: string;
  toolsUsed?: string[];
}

// Message types for worker communication
export type WorkerMessage = WorkerTask<EnhancePromptPayload> | WorkerTask<SubagentPayload>;

export type WorkerResponse = WorkerResult<EnhancePromptResult> | WorkerResult<SubagentResult>;

// IPC event types for renderer
export interface WorkerListUpdate {
  workers: WorkerInfo[];
}

export interface WorkerStreamUpdate {
  workerId: string;
  delta: string;
}

// Task type to label mapping
export const TASK_TYPE_LABELS: Record<WorkerTaskType, string> = {
  'enhance-prompt': 'Enhancing prompt',
  subagent: 'Running subagent'
};
