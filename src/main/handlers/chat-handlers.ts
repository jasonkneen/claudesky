import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join, relative } from 'path';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { BrowserWindow, ipcMain } from 'electron';

import { ATTACHMENTS_DIR_NAME, MAX_ATTACHMENT_BYTES } from '../../shared/constants';
import type {
  ChatModelPreference,
  EnhancePromptResponse,
  SavedAttachmentInfo,
  SendMessagePayload,
  SerializedAttachmentPayload,
  ThinkingMode
} from '../../shared/types/ipc';
import {
  getCurrentModelPreference,
  getCurrentSessionCwd,
  getCurrentThinkingMode,
  interruptCurrentResponse,
  isSessionActive,
  resetSession,
  setActiveChatWindow,
  setActivePaneId,
  setChatModelPreference,
  setThinkingMode,
  setWindowCwd,
  startStreamingSession
} from '../lib/claude-session';
import { getApiKey, getWorkspaceDir } from '../lib/config';
import { getSessionId, messageQueue } from '../lib/message-queue';
import { getStoredValidAccessToken } from '../lib/oauth';
import { deriveThemeFromMessage, logEvent, updateSessionTheme } from '../lib/session-logger';
import { enhancePrompt } from '../lib/utility-session';

export function registerChatHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('chat:send-message', async (event, payload: SendMessagePayload) => {
    console.log('[chat-handlers] chat:send-message received, payload:', JSON.stringify(payload));
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    setActiveChatWindow(sourceWindow ?? getMainWindow());

    // Store active pane ID for this session
    setActivePaneId(payload.paneId || null);

    // Store per-window cwd if provided
    if (payload.cwd && sourceWindow) {
      setWindowCwd(sourceWindow.id, payload.cwd);

      // Check if cwd changed from current session - if so, reset to start fresh
      const currentCwd = getCurrentSessionCwd();
      if (currentCwd && currentCwd !== payload.cwd && isSessionActive()) {
        console.log(`[chat-handlers] CWD changed from "${currentCwd}" to "${payload.cwd}" - resetting session`);
        await resetSession();
      }
    }
    // Check for API key or OAuth token
    const apiKey = getApiKey();
    console.log('[chat-handlers] apiKey exists:', !!apiKey);
    const oauthToken = !apiKey ? await getStoredValidAccessToken() : null;
    console.log('[chat-handlers] oauthToken exists:', !!oauthToken);
    if (!apiKey && !oauthToken) {
      console.log('[chat-handlers] No API key or OAuth token - returning error');
      return {
        success: false,
        error:
          'API key is not configured. Add your Anthropic API key in Settings, set ANTHROPIC_API_KEY, or login with OAuth.'
      };
    }

    const normalizedPayload = payload ?? { text: '', attachments: [] };
    const text = normalizedPayload.text?.trim() ?? '';
    const attachments = normalizedPayload.attachments ?? [];

    if (!text && attachments.length === 0) {
      return { success: false, error: 'Please enter a message or attach a file before sending.' };
    }

    try {
      const savedAttachments = await persistAttachments(attachments);

      const userMessage = buildUserMessage(text, savedAttachments);

      // Start streaming session if not already running
      console.log('[chat-handlers] isSessionActive:', isSessionActive());
      if (!isSessionActive()) {
        console.log('[chat-handlers] Starting new streaming session...');
        // Fire-and-forget: the session loop is long-lived and should not block message queueing.
        void startStreamingSession(sourceWindow ?? getMainWindow());
      }

      // Queue the message
      await new Promise<void>((resolve) => {
        messageQueue.push({ message: userMessage, resolve });
      });

      // Log user message to session log
      const currentSessionId = getSessionId();
      logEvent(currentSessionId, 'user_message', {
        text,
        attachments: savedAttachments.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          size: a.size,
          path: a.relativePath
        })),
        message: userMessage
      });

      // Update session theme based on first user message
      const theme = deriveThemeFromMessage(userMessage);
      updateSessionTheme(currentSessionId, theme);

      return { success: true, attachments: savedAttachments };
    } catch (error) {
      console.error('Error queueing message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('chat:reset-session', async (_event, resumeSessionId?: string | null) => {
    try {
      await resetSession(resumeSessionId);
      return { success: true };
    } catch (error) {
      console.error('Error resetting session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('chat:stop-message', async (event) => {
    try {
      const sourceWindow = BrowserWindow.fromWebContents(event.sender);
      const mainWindow = sourceWindow ?? getMainWindow();
      setActiveChatWindow(mainWindow);
      const wasInterrupted = await interruptCurrentResponse(mainWindow);
      if (!wasInterrupted) {
        return { success: false, error: 'No active response to stop.' };
      }
      return { success: true };
    } catch (error) {
      console.error('Error stopping response:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('chat:get-model-preference', async () => {
    return {
      preference: getCurrentModelPreference()
    };
  });

  ipcMain.handle('chat:set-model-preference', async (_event, preference: ChatModelPreference) => {
    try {
      await setChatModelPreference(preference);
      return { success: true, preference: getCurrentModelPreference() };
    } catch (error) {
      console.error('Error updating model preference:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage, preference: getCurrentModelPreference() };
    }
  });

  ipcMain.handle('chat:get-thinking-mode', async () => {
    return {
      mode: getCurrentThinkingMode()
    };
  });

  ipcMain.handle('chat:set-thinking-mode', async (_event, mode: unknown) => {
    const VALID_MODES = ['off', 'low', 'medium', 'high', 'ultra'] as const;

    if (typeof mode !== 'string' || !VALID_MODES.includes(mode as (typeof VALID_MODES)[number])) {
      return { success: false, error: 'Invalid thinking mode', mode: getCurrentThinkingMode() };
    }

    try {
      setThinkingMode(mode as ThinkingMode);
      return { success: true, mode: getCurrentThinkingMode() };
    } catch (error) {
      console.error('Error updating thinking mode:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage, mode: getCurrentThinkingMode() };
    }
  });

  ipcMain.handle(
    'chat:enhance-prompt',
    async (_event, prompt: string): Promise<EnhancePromptResponse> => {
      console.log('[enhance-prompt] Handler called');
      try {
        if (!prompt?.trim()) {
          return {
            success: false,
            error: 'Please provide a prompt to enhance.'
          };
        }

        // Use the persistent utility session for prompt enhancement
        const enhancedPrompt = await enhancePrompt(prompt);

        console.log('[enhance-prompt] Got response, length:', enhancedPrompt.length);

        return {
          success: true,
          enhancedPrompt
        };
      } catch (error) {
        console.error('[enhance-prompt] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return { success: false, error: errorMessage };
      }
    }
  );
}

function sanitizeFileName(name: string): string {
  const withoutIllegal = name.replace(/[<>:"/\\|?*]/g, '_');
  const withoutControlChars = Array.from(withoutIllegal)
    .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('');
  return withoutControlChars.replace(/\s+/g, ' ').trim() || 'attachment';
}

async function persistAttachments(
  attachments: SerializedAttachmentPayload[]
): Promise<SavedAttachmentInfo[]> {
  if (attachments.length === 0) {
    return [];
  }

  const workspaceDir = getWorkspaceDir();
  const destinationDir = join(workspaceDir, ATTACHMENTS_DIR_NAME);
  await mkdir(destinationDir, { recursive: true });

  const saves: SavedAttachmentInfo[] = [];

  for (const attachment of attachments) {
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(
        `Attachment "${attachment.name}" exceeds the ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB limit.`
      );
    }

    const sanitized = sanitizeFileName(attachment.name);
    const uniqueName = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitized}`;
    const savedPath = join(destinationDir, uniqueName);

    const buffer =
      attachment.data instanceof Uint8Array ?
        Buffer.from(attachment.data.buffer, attachment.data.byteOffset, attachment.data.byteLength)
      : Buffer.from(attachment.data);

    await writeFile(savedPath, buffer);

    const relativePath = relative(workspaceDir, savedPath);

    saves.push({
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      savedPath,
      relativePath: relativePath.startsWith('..') ? savedPath : relativePath
    });
  }

  return saves;
}

function buildUserMessage(
  text: string,
  attachments: SavedAttachmentInfo[]
): SDKUserMessage['message'] {
  const contentBlocks: { type: 'text'; text: string }[] = [];
  if (text) {
    contentBlocks.push({ type: 'text', text });
  }

  attachments.forEach((attachment) => {
    const relativeSegment = attachment.relativePath;
    const relativeWithinWorkspace =
      relativeSegment && !relativeSegment.startsWith('..') ? relativeSegment : null;
    const readTarget =
      relativeWithinWorkspace ?
        relativeWithinWorkspace.startsWith('.') ?
          relativeWithinWorkspace
        : `./${relativeWithinWorkspace}`
      : attachment.savedPath;
    const displayPath = relativeWithinWorkspace ? readTarget : attachment.savedPath;
    const instruction = `Attachment "${attachment.name}" is available at ${displayPath}. Please run Read("${readTarget}") when you need to inspect it.`;
    contentBlocks.push({ type: 'text', text: instruction });
  });

  if (contentBlocks.length === 0) {
    contentBlocks.push({
      type: 'text',
      text: 'User uploaded files without additional context.'
    });
  }

  return {
    role: 'user',
    content: contentBlocks
  };
}
