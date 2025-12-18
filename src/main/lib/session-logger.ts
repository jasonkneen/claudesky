import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import { getWorkspaceDir } from './config';

interface SessionLogEntry {
  timestamp: string; // ISO 8601 format
  sessionId: string;
  eventType: string;
  data: unknown;
}

interface SessionMetadata {
  sessionId: string;
  theme: string;
  startedAt: string;
  filePath: string;
}

const activeSessions = new Map<string, SessionMetadata>();

/**
 * Gets the .claudelet directory path in the workspace
 */
function getClaudeletDir(): string {
  const workspaceDir = getWorkspaceDir();
  return join(workspaceDir, '.claudelet');
}

/**
 * Gets the date-based directory for logs (YYYY-MM-DD)
 */
function getDateDir(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return join(getClaudeletDir(), `${year}-${month}-${day}`);
}

/**
 * Sanitizes a string for use in filenames
 */
function sanitizeForFilename(str: string): string {
  return str
    .replace(/[<>:"/\\|?*]/g, '_') // Remove illegal characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .substring(0, 50) // Limit length
    .trim();
}

/**
 * Generates a theme from the first user message
 */
function extractTheme(firstMessage: string): string {
  // Take first 50 chars of first sentence
  const firstSentence = firstMessage.split(/[.!?]/)[0];
  return sanitizeForFilename(firstSentence || 'conversation');
}

/**
 * Gets a short session ID for filename (first 8 chars)
 */
function getShortSessionId(sessionId: string): string {
  return sessionId.substring(0, 8);
}

/**
 * Starts a new session log
 */
export function startSessionLog(sessionId: string, theme?: string): void {
  if (activeSessions.has(sessionId)) {
    return; // Already logging this session
  }

  const dateDir = getDateDir();

  // Ensure directories exist
  mkdirSync(dateDir, { recursive: true });

  // Use provided theme or default
  const sessionTheme = theme || 'session';
  const shortId = getShortSessionId(sessionId);
  const filename = `${sessionTheme}_${shortId}.jsonl`;
  const filePath = join(dateDir, filename);

  const metadata: SessionMetadata = {
    sessionId,
    theme: sessionTheme,
    startedAt: new Date().toISOString(),
    filePath
  };

  activeSessions.set(sessionId, metadata);

  // Write session start log entry
  logEvent(sessionId, 'session_start', {
    sessionId,
    theme: sessionTheme,
    startedAt: metadata.startedAt
  });
}

/**
 * Updates the theme for an active session (useful when first message arrives)
 */
export function updateSessionTheme(sessionId: string, newTheme: string): void {
  const metadata = activeSessions.get(sessionId);
  if (!metadata) {
    return;
  }

  const sanitizedTheme = sanitizeForFilename(newTheme);
  const shortId = getShortSessionId(sessionId);
  const dateDir = getDateDir(new Date(metadata.startedAt));
  const newFilename = `${sanitizedTheme}_${shortId}.jsonl`;
  const newFilePath = join(dateDir, newFilename);

  // If theme changed and file exists, rename it
  if (metadata.filePath !== newFilePath && existsSync(metadata.filePath)) {
    try {
      const fs = require('fs');
      fs.renameSync(metadata.filePath, newFilePath);
      metadata.filePath = newFilePath;
      metadata.theme = sanitizedTheme;
    } catch (error) {
      console.error('Failed to rename session log file:', error);
    }
  }
}

/**
 * Logs an event for a session
 */
export function logEvent(sessionId: string, eventType: string, data: unknown): void {
  const metadata = activeSessions.get(sessionId);
  if (!metadata) {
    // Session not started yet - start it with default theme
    startSessionLog(sessionId);
    return logEvent(sessionId, eventType, data);
  }

  const entry: SessionLogEntry = {
    timestamp: new Date().toISOString(),
    sessionId,
    eventType,
    data
  };

  try {
    // Append as single-line JSON (JSONL format)
    appendFileSync(metadata.filePath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (error) {
    console.error('Failed to write session log entry:', error);
  }
}

/**
 * Ends a session log
 */
export function endSessionLog(sessionId: string): void {
  const metadata = activeSessions.get(sessionId);
  if (!metadata) {
    return;
  }

  logEvent(sessionId, 'session_end', {
    sessionId,
    endedAt: new Date().toISOString(),
    duration: Date.now() - new Date(metadata.startedAt).getTime()
  });

  activeSessions.delete(sessionId);
}

/**
 * Gets metadata for an active session
 */
export function getActiveSessionMetadata(sessionId: string): SessionMetadata | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Extracts theme from message content
 */
export function deriveThemeFromMessage(message: { role: string; content: unknown }): string {
  if (message.role !== 'user') {
    return 'conversation';
  }

  let textContent = '';

  if (typeof message.content === 'string') {
    textContent = message.content;
  } else if (Array.isArray(message.content)) {
    // Extract text from content blocks
    for (const block of message.content) {
      if (typeof block === 'object' && block !== null && 'text' in block) {
        textContent = String(block.text);
        break;
      }
    }
  }

  return extractTheme(textContent);
}
