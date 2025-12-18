/**
 * Claude Agent Loop
 *
 * A standalone package that provides the core agentic conversation loops
 * for the Claude Agent SDK. This package extracts the message queue and
 * streaming session management from Claude Agent Desktop.
 *
 * ## Core Concepts
 *
 * ### 1. Message Queue (Input Loop)
 * The message queue provides an async generator that:
 * - Runs in an infinite `while(true)` loop
 * - Waits for messages to be queued via `queueMessage()`
 * - Yields `SDKUserMessage` objects to the SDK's `query()` function
 * - Can be aborted gracefully for clean shutdown
 *
 * ### 2. Agent Session (Output Loop)
 * The agent session provides a streaming response processor that:
 * - Uses `for await` to iterate over SDK streaming responses
 * - Parses different message types (text, thinking, tool use, results)
 * - Emits events for each type of content
 * - Handles session lifecycle (start, interrupt, stop)
 *
 * ## Quick Start
 *
 * ```typescript
 * import { startAgentSession } from 'claude-agent-loop';
 *
 * const session = await startAgentSession(
 *   {
 *     apiKey: process.env.ANTHROPIC_API_KEY!,
 *     workingDirectory: process.cwd(),
 *     modelPreference: 'smart-sonnet'
 *   },
 *   {
 *     onTextChunk: (text) => process.stdout.write(text),
 *     onToolUseStart: (tool) => console.log(`\n[Using ${tool.name}]`),
 *     onMessageComplete: () => console.log('\n---')
 *   }
 * );
 *
 * // Send messages
 * await session.sendMessage({ role: 'user', content: 'Hello!' });
 *
 * // Later, stop the session
 * await session.stop();
 * ```
 *
 * @packageDocumentation
 */

// Export types
export type {
  AgentSessionEvents,
  AgentSessionHandle,
  AgentSessionOptions,
  MessageQueueItem,
  ModelPreference
} from './types.js';

// Export message queue functions
export {
  abortGenerator,
  clearMessageQueue,
  getMessageQueue,
  getSessionId,
  messageGenerator,
  queueMessage,
  regenerateSessionId,
  resetAbortFlag,
  resetMessageQueueState,
  setSessionId,
  shouldAbortGenerator
} from './message-queue.js';

// Export agent session functions
export {
  interruptCurrentResponse,
  isSessionActive,
  resetSession,
  setModel,
  startAgentSession
} from './agent-session.js';

// Export smart message queue (priority-based with auto-injection)
export { SmartMessageQueue, globalMessageQueue } from './smart-message-queue.js';
export type { PendingMessage } from './smart-message-queue.js';

// Export authentication manager
export { AuthenticationManager, createAuthManager } from './auth.js';
export type { AuthConfig, OAuthFlowResult } from './auth.js';
