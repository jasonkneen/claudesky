import { contextBridge, ipcRenderer } from 'electron';

import type {
  AuthMode,
  ChatModelPreference,
  EnhancePromptResponse,
  GeminiApiKeyResponse,
  GetThinkingModeResponse,
  SendMessagePayload,
  SetGeminiApiKeyResponse,
  SetThinkingModeResponse,
  ThinkingMode
} from '../shared/types/ipc';
import type { WorkerInfo, WorkerListUpdate, WorkerStreamUpdate } from '../shared/types/worker';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  onNavigate: (callback: (view: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, view: string) => callback(view);
    ipcRenderer.on('navigate', listener);
    return () => ipcRenderer.removeListener('navigate', listener);
  },
  chat: {
    sendMessage: (payload: SendMessagePayload) => ipcRenderer.invoke('chat:send-message', payload),
    stopMessage: () => ipcRenderer.invoke('chat:stop-message'),
    resetSession: (resumeSessionId?: string | null) =>
      ipcRenderer.invoke('chat:reset-session', resumeSessionId),
    getModelPreference: () => ipcRenderer.invoke('chat:get-model-preference'),
    setModelPreference: (preference: ChatModelPreference) =>
      ipcRenderer.invoke('chat:set-model-preference', preference),
    getThinkingMode: (): Promise<GetThinkingModeResponse> =>
      ipcRenderer.invoke('chat:get-thinking-mode'),
    setThinkingMode: (mode: ThinkingMode): Promise<SetThinkingModeResponse> =>
      ipcRenderer.invoke('chat:set-thinking-mode', mode),
    enhancePrompt: (prompt: string): Promise<EnhancePromptResponse> =>
      ipcRenderer.invoke('chat:enhance-prompt', prompt),
    handoffToAgent: (payload: {
      agentType: string;
      context: string;
      taskDescription: string;
      customInstructions?: string;
    }) => ipcRenderer.invoke('chat:handoff-to-agent', payload),
    onMessageChunk: (callback: (chunk: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk);
      ipcRenderer.on('chat:message-chunk', listener);
      return () => ipcRenderer.removeListener('chat:message-chunk', listener);
    },
    onThinkingStart: (callback: (data: { index: number }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { index: number }) =>
        callback(data);
      ipcRenderer.on('chat:thinking-start', listener);
      return () => ipcRenderer.removeListener('chat:thinking-start', listener);
    },
    onThinkingChunk: (callback: (data: { index: number; delta: string }) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { index: number; delta: string }
      ) => callback(data);
      ipcRenderer.on('chat:thinking-chunk', listener);
      return () => ipcRenderer.removeListener('chat:thinking-chunk', listener);
    },
    onMessageComplete: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('chat:message-complete', listener);
      return () => ipcRenderer.removeListener('chat:message-complete', listener);
    },
    onMessageStopped: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('chat:message-stopped', listener);
      return () => ipcRenderer.removeListener('chat:message-stopped', listener);
    },
    onMessageError: (callback: (error: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
      ipcRenderer.on('chat:message-error', listener);
      return () => ipcRenderer.removeListener('chat:message-error', listener);
    },
    onDebugMessage: (callback: (message: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message);
      ipcRenderer.on('chat:debug-message', listener);
      return () => ipcRenderer.removeListener('chat:debug-message', listener);
    },
    onToolUseStart: (
      callback: (tool: {
        id: string;
        name: string;
        input: Record<string, unknown>;
        streamIndex: number;
      }) => void
    ) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        tool: { id: string; name: string; input: Record<string, unknown>; streamIndex: number }
      ) => callback(tool);
      ipcRenderer.on('chat:tool-use-start', listener);
      return () => ipcRenderer.removeListener('chat:tool-use-start', listener);
    },
    onToolInputDelta: (callback: (data: { index: number; delta: string }) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { index: number; delta: string }
      ) => callback(data);
      ipcRenderer.on('chat:tool-input-delta', listener);
      return () => ipcRenderer.removeListener('chat:tool-input-delta', listener);
    },
    onContentBlockStop: (callback: (data: { index: number }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { index: number }) =>
        callback(data);
      ipcRenderer.on('chat:content-block-stop', listener);
      return () => ipcRenderer.removeListener('chat:content-block-stop', listener);
    },
    onToolResultStart: (
      callback: (data: { toolUseId: string; content: string; isError: boolean }) => void
    ) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { toolUseId: string; content: string; isError: boolean }
      ) => callback(data);
      ipcRenderer.on('chat:tool-result-start', listener);
      return () => ipcRenderer.removeListener('chat:tool-result-start', listener);
    },
    onToolResultDelta: (callback: (data: { toolUseId: string; delta: string }) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { toolUseId: string; delta: string }
      ) => callback(data);
      ipcRenderer.on('chat:tool-result-delta', listener);
      return () => ipcRenderer.removeListener('chat:tool-result-delta', listener);
    },
    onToolResultComplete: (
      callback: (data: { toolUseId: string; content: string; isError?: boolean }) => void
    ) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { toolUseId: string; content: string; isError?: boolean }
      ) => callback(data);
      ipcRenderer.on('chat:tool-result-complete', listener);
      return () => ipcRenderer.removeListener('chat:tool-result-complete', listener);
    },
    onSessionUpdated: (callback: (data: { sessionId: string; resumed: boolean }) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { sessionId: string; resumed: boolean }
      ) => callback(data);
      ipcRenderer.on('chat:session-updated', listener);
      return () => ipcRenderer.removeListener('chat:session-updated', listener);
    }
  },
  config: {
    getWorkspaceDir: () => ipcRenderer.invoke('config:get-workspace-dir'),
    setWorkspaceDir: (workspaceDir: string) =>
      ipcRenderer.invoke('config:set-workspace-dir', workspaceDir),
    getDebugMode: () => ipcRenderer.invoke('config:get-debug-mode'),
    setDebugMode: (debugMode: boolean) => ipcRenderer.invoke('config:set-debug-mode', debugMode),
    getPathInfo: () => ipcRenderer.invoke('config:get-path-info'),
    getEnvVars: () => ipcRenderer.invoke('config:get-env-vars'),
    getDiagnosticMetadata: () => ipcRenderer.invoke('config:get-diagnostic-metadata'),
    getApiKeyStatus: () => ipcRenderer.invoke('config:get-api-key-status'),
    setApiKey: (apiKey?: string | null) => ipcRenderer.invoke('config:set-api-key', apiKey),
    getBaseUrlStatus: () => ipcRenderer.invoke('config:get-base-url-status'),
    setBaseUrl: (baseUrl?: string | null) => ipcRenderer.invoke('config:set-base-url', baseUrl),
    getGeminiApiKey: (): Promise<GeminiApiKeyResponse> =>
      ipcRenderer.invoke('config:get-gemini-api-key'),
    setGeminiApiKey: (geminiApiKey?: string | null): Promise<SetGeminiApiKeyResponse> =>
      ipcRenderer.invoke('config:set-gemini-api-key', geminiApiKey),
    getMcpServers: () => ipcRenderer.invoke('config:get-mcp-servers'),
    setMcpServers: (mcpServers: unknown) =>
      ipcRenderer.invoke('config:set-mcp-servers', mcpServers),
    discoverMcpServers: () => ipcRenderer.invoke('config:discover-mcp-servers'),
    getMcpApprovals: () => ipcRenderer.invoke('config:get-mcp-approvals'),
    setMcpToolApproval: (toolId: string, status: 'disabled' | 'enabled' | 'always_allowed') =>
      ipcRenderer.invoke('config:set-mcp-tool-approval', toolId, status),
    setMcpServerEnabled: (serverName: string, enabled: boolean) =>
      ipcRenderer.invoke('config:set-mcp-server-enabled', serverName, enabled),
    hideDiscoveredServer: (serverName: string) =>
      ipcRenderer.invoke('config:hide-discovered-server', serverName)
  },
  files: {
    getWorkspaceFiles: (baseDir: string) => ipcRenderer.invoke('files:get-workspace-files', baseDir)
  },
  microphone: {
    requestPermission: () => ipcRenderer.invoke('microphone:request-permission')
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
  },
  oauth: {
    startLogin: (mode: AuthMode) => ipcRenderer.invoke('oauth:start-login', mode),
    completeLogin: (code: string, verifier: string, state: string, createKey?: boolean) =>
      ipcRenderer.invoke('oauth:complete-login', code, verifier, state, createKey),
    cancel: () => ipcRenderer.invoke('oauth:cancel'),
    getStatus: () => ipcRenderer.invoke('oauth:get-status'),
    logout: () => ipcRenderer.invoke('oauth:logout'),
    getAccessToken: () => ipcRenderer.invoke('oauth:get-access-token')
  },
  conversation: {
    list: () => ipcRenderer.invoke('conversation:list'),
    create: (messages: unknown[], sessionId?: string | null) =>
      ipcRenderer.invoke('conversation:create', messages, sessionId),
    get: (id: string) => ipcRenderer.invoke('conversation:get', id),
    update: (id: string, title?: string, messages?: unknown[], sessionId?: string | null) =>
      ipcRenderer.invoke('conversation:update', id, title, messages, sessionId),
    delete: (id: string) => ipcRenderer.invoke('conversation:delete', id)
  },
  update: {
    getStatus: () => ipcRenderer.invoke('update:get-status'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatusChanged: (
      callback: (status: {
        checking: boolean;
        updateAvailable: boolean;
        downloading: boolean;
        downloadProgress: number;
        readyToInstall: boolean;
        error: string | null;
        updateInfo: {
          version: string;
          releaseDate: string;
          releaseNotes?: string;
        } | null;
        lastCheckComplete: boolean;
      }) => void
    ) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        status: {
          checking: boolean;
          updateAvailable: boolean;
          downloading: boolean;
          downloadProgress: number;
          readyToInstall: boolean;
          error: string | null;
          updateInfo: {
            version: string;
            releaseDate: string;
            releaseNotes?: string;
          } | null;
          lastCheckComplete: boolean;
        }
      ) => callback(status);
      ipcRenderer.on('update:status-changed', listener);
      return () => ipcRenderer.removeListener('update:status-changed', listener);
    }
  },
  worker: {
    list: (): Promise<{ workers: WorkerInfo[] }> => ipcRenderer.invoke('worker:list'),
    get: (workerId: string): Promise<{ worker: WorkerInfo | null }> =>
      ipcRenderer.invoke('worker:get', workerId),
    kill: (workerId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('worker:kill', workerId),
    killAll: (): Promise<{ success: boolean }> => ipcRenderer.invoke('worker:kill-all'),
    onListUpdate: (callback: (data: WorkerListUpdate) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: WorkerListUpdate) =>
        callback(data);
      ipcRenderer.on('worker:list-update', listener);
      return () => ipcRenderer.removeListener('worker:list-update', listener);
    },
    onStreamUpdate: (callback: (data: WorkerStreamUpdate) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: WorkerStreamUpdate) =>
        callback(data);
      ipcRenderer.on('worker:stream-update', listener);
      return () => ipcRenderer.removeListener('worker:stream-update', listener);
    }
  },
  project: {
    open: (projectPath: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('project:open', projectPath),
    listRecent: (): Promise<{
      projects: Array<{ path: string; name: string; lastOpened?: string }>;
    }> => ipcRenderer.invoke('project:list-recent'),
    getFromUrl: (): string | null => {
      const params = new URLSearchParams(window.location.search);
      return params.get('project');
    },
    browse: (): Promise<{ path: string | null; canceled: boolean }> =>
      ipcRenderer.invoke('project:browse')
  },
  tab: {
    create: (
      type: 'todos' | 'kanban' | 'notes' | 'picker' | 'browser'
    ): Promise<{ success: boolean }> => ipcRenderer.invoke('tab:create', type),
    getType: (): 'project' | 'todos' | 'kanban' | 'notes' | 'picker' | 'browser' | 'home' => {
      const search = window.location.search;
      const params = new URLSearchParams(search);
      const type = params.get('type');
      const project = params.get('project');
      console.log('[preload.getType] search:', search);
      console.log('[preload.getType] type param:', type);
      console.log('[preload.getType] project param:', project);
      // Check for all valid types
      if (
        type === 'todos' ||
        type === 'kanban' ||
        type === 'notes' ||
        type === 'picker' ||
        type === 'browser' ||
        type === 'project'
      ) {
        console.log('[preload.getType] returning:', type);
        return type;
      }
      // Legacy: if there's a project param without type, it's a project tab
      if (project) {
        console.log('[preload.getType] returning: project (from project param)');
        return 'project';
      }
      // Otherwise it's the home tab
      console.log('[preload.getType] returning: home (default)');
      return 'home';
    }
  },
  theme: {
    set: (theme: 'light' | 'dark' | 'system'): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('theme:set', theme),
    get: (): Promise<{ theme: string; shouldUseDarkColors: boolean }> =>
      ipcRenderer.invoke('theme:get')
  },
  browser: {
    getRecentUrls: (): Promise<{
      urls: Array<{ url: string; timestamp: number; title?: string }>;
    }> => ipcRenderer.invoke('browser:get-recent-urls'),
    addRecentUrl: (url: string, title?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('browser:add-recent-url', url, title),
    removeRecentUrl: (url: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('browser:remove-recent-url', url),
    clearRecentUrls: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('browser:clear-recent-urls')
  }
});
