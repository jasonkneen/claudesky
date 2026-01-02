import type {
  AuthMode,
  ChatModelPreference,
  DiscoverMcpServersResponse,
  EnhancePromptResponse,
  GetChatModelPreferenceResponse,
  GetMcpApprovalResponse,
  GetMcpServersResponse,
  GetThinkingModeResponse,
  McpApprovalConfig,
  McpServerEnabledState,
  McpServersConfig,
  OAuthAccessTokenResponse,
  OAuthCompleteLoginResponse,
  OAuthStartLoginResponse,
  OAuthStatusResponse,
  SendMessagePayload,
  SendMessageResponse,
  SetChatModelPreferenceResponse,
  SetMcpServersResponse,
  SetThinkingModeResponse,
  ThinkingMode
} from '../shared/types/ipc';
import type { WorkerInfo, WorkerListUpdate, WorkerStreamUpdate } from '../shared/types/worker';

export type ChatResponse = SendMessageResponse;

export interface WorkspaceResponse {
  workspaceDir: string;
}

export interface SetWorkspaceResponse {
  success: boolean;
  error?: string;
}

export interface PathInfoResponse {
  platform: string;
  pathSeparator: string;
  pathEntries: string[];
  pathCount: number;
  fullPath: string;
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface EnvVarsResponse {
  envVars: EnvVar[];
  count: number;
}

export interface DiagnosticMetadataResponse {
  appVersion: string;
  electronVersion: string;
  chromiumVersion: string;
  v8Version: string;
  nodeVersion: string;
  claudeAgentSdkVersion: string;
  platform: string;
  arch: string;
  osRelease: string;
  osType: string;
  osVersion: string;
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
  streamIndex: number;
}

export interface ToolInputDelta {
  index: number;
  toolId: string;
  delta: string;
}

export interface ContentBlockStop {
  index: number;
  toolId?: string;
}

export interface ToolResultStart {
  toolUseId: string;
  content: string;
  isError: boolean;
}

export interface ToolResultDelta {
  toolUseId: string;
  delta: string;
}

export interface ToolResultComplete {
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export interface UpdateStatus {
  checking: boolean;
  updateAvailable: boolean;
  downloading: boolean;
  downloadProgress: number;
  readyToInstall: boolean;
  error: string | null;
  updateInfo: UpdateInfo | null;
  lastCheckComplete: boolean;
}

export interface ThinkingStart {
  index: number;
}

export interface ThinkingChunk {
  index: number;
  delta: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: string; // JSON stringified Message[]
  createdAt: number;
  updatedAt: number;
  sessionId?: string | null;
}

export interface ConversationListResponse {
  success: boolean;
  conversations?: Conversation[];
  error?: string;
}

export interface ConversationGetResponse {
  success: boolean;
  conversation?: Conversation;
  error?: string;
}

export interface ConversationCreateResponse {
  success: boolean;
  conversation?: Conversation;
  error?: string;
}

export interface ConversationUpdateResponse {
  success: boolean;
  error?: string;
}

export interface ConversationDeleteResponse {
  success: boolean;
  error?: string;
}

export interface FileItem {
  path: string;
  name: string;
  isDirectory: boolean;
}

export interface GetWorkspaceFilesResponse {
  success: boolean;
  files?: FileItem[];
  error?: string;
}

export interface RecentUrlItem {
  url: string;
  timestamp: number;
  title?: string;
}

export interface GetRecentUrlsResponse {
  urls: RecentUrlItem[];
}

export interface ElectronAPI {
  onNavigate: (callback: (view: string) => void) => () => void;
  chat: {
    sendMessage: (payload: SendMessagePayload) => Promise<ChatResponse>;
    stopMessage: () => Promise<{ success: boolean; error?: string }>;
    resetSession: (
      resumeSessionId?: string | null
    ) => Promise<{ success: boolean; error?: string }>;
    getModelPreference: () => Promise<GetChatModelPreferenceResponse>;
    setModelPreference: (
      preference: ChatModelPreference
    ) => Promise<SetChatModelPreferenceResponse>;
    getThinkingMode: () => Promise<GetThinkingModeResponse>;
    setThinkingMode: (mode: ThinkingMode) => Promise<SetThinkingModeResponse>;
    enhancePrompt: (prompt: string) => Promise<EnhancePromptResponse>;
    onMessageChunk: (callback: (chunk: string, paneId?: string) => void) => () => void;
    onThinkingStart: (callback: (data: ThinkingStart, paneId?: string) => void) => () => void;
    onThinkingChunk: (callback: (data: ThinkingChunk, paneId?: string) => void) => () => void;
    onMessageComplete: (callback: (paneId?: string) => void) => () => void;
    onMessageStopped: (callback: (paneId?: string) => void) => () => void;
    onMessageError: (callback: (error: string, paneId?: string) => void) => () => void;
    onDebugMessage: (callback: (message: string, paneId?: string) => void) => () => void;
    onToolUseStart: (callback: (tool: ToolUse, paneId?: string) => void) => () => void;
    onToolInputDelta: (callback: (data: ToolInputDelta, paneId?: string) => void) => () => void;
    onContentBlockStop: (callback: (data: ContentBlockStop, paneId?: string) => void) => () => void;
    onToolResultStart: (callback: (data: ToolResultStart, paneId?: string) => void) => () => void;
    onToolResultDelta: (callback: (data: ToolResultDelta) => void) => () => void;
    onToolResultComplete: (callback: (data: ToolResultComplete, paneId?: string) => void) => () => void;
    onSessionUpdated: (
      callback: (data: { sessionId: string; resumed: boolean }) => void
    ) => () => void;
  };
  config: {
    getWorkspaceDir: () => Promise<WorkspaceResponse>;
    setWorkspaceDir: (workspaceDir: string) => Promise<SetWorkspaceResponse>;
    getDebugMode: () => Promise<{ debugMode: boolean }>;
    setDebugMode: (debugMode: boolean) => Promise<{ success: boolean }>;
    getPathInfo: () => Promise<PathInfoResponse>;
    getEnvVars: () => Promise<EnvVarsResponse>;
    getDiagnosticMetadata: () => Promise<DiagnosticMetadataResponse>;
    getApiKeyStatus: () => Promise<{
      status: { configured: boolean; source: 'env' | 'local' | null; lastFour: string | null };
    }>;
    setApiKey: (apiKey?: string | null) => Promise<{
      success: boolean;
      status: { configured: boolean; source: 'env' | 'local' | null; lastFour: string | null };
    }>;
    getBaseUrlStatus: () => Promise<{
      status: { configured: boolean; source: 'env' | 'local' | null; url: string | null };
    }>;
    setBaseUrl: (baseUrl?: string | null) => Promise<{
      success: boolean;
      status: { configured: boolean; source: 'env' | 'local' | null; url: string | null };
    }>;
    getMcpServers: () => Promise<GetMcpServersResponse>;
    setMcpServers: (mcpServers: McpServersConfig) => Promise<SetMcpServersResponse>;
    discoverMcpServers: () => Promise<DiscoverMcpServersResponse>;
    getMcpApprovals: () => Promise<GetMcpApprovalResponse>;
    setMcpToolApproval: (
      toolId: string,
      status: 'disabled' | 'enabled' | 'always_allowed'
    ) => Promise<{ success: boolean; approvals: McpApprovalConfig }>;
    setMcpServerEnabled: (
      serverName: string,
      enabled: boolean
    ) => Promise<{ success: boolean; enabled: McpServerEnabledState }>;
    hideDiscoveredServer: (
      serverName: string
    ) => Promise<{ success: boolean; hidden?: string[]; error?: string }>;
  };
  shell: {
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  };
  files: {
    getWorkspaceFiles: (baseDir: string) => Promise<GetWorkspaceFilesResponse>;
  };
  microphone: {
    requestPermission: () => Promise<{ granted: boolean; error?: string }>;
  };
  oauth: {
    startLogin: (mode: AuthMode) => Promise<OAuthStartLoginResponse>;
    completeLogin: (
      code: string,
      verifier: string,
      state: string,
      createKey?: boolean
    ) => Promise<OAuthCompleteLoginResponse>;
    cancel: () => Promise<{ success: boolean }>;
    getStatus: () => Promise<OAuthStatusResponse>;
    logout: () => Promise<{ success: boolean; error?: string }>;
    getAccessToken: () => Promise<OAuthAccessTokenResponse>;
  };
  conversation: {
    list: () => Promise<ConversationListResponse>;
    create: (messages: unknown[], sessionId?: string | null) => Promise<ConversationCreateResponse>;
    get: (id: string) => Promise<ConversationGetResponse>;
    update: (
      id: string,
      title?: string,
      messages?: unknown[],
      sessionId?: string | null
    ) => Promise<ConversationUpdateResponse>;
    delete: (id: string) => Promise<ConversationDeleteResponse>;
  };
  update: {
    getStatus: () => Promise<UpdateStatus>;
    check: () => Promise<{ success: boolean }>;
    download: () => Promise<{ success: boolean }>;
    install: () => Promise<{ success: boolean }>;
    onStatusChanged: (callback: (status: UpdateStatus) => void) => () => void;
  };
  worker: {
    list: () => Promise<{ workers: WorkerInfo[] }>;
    get: (workerId: string) => Promise<{ worker: WorkerInfo | null }>;
    kill: (workerId: string) => Promise<{ success: boolean }>;
    killAll: () => Promise<{ success: boolean }>;
    onListUpdate: (callback: (data: WorkerListUpdate) => void) => () => void;
    onStreamUpdate: (callback: (data: WorkerStreamUpdate) => void) => () => void;
  };
  project: {
    open: (projectPath: string) => Promise<{ success: boolean }>;
    listRecent: () => Promise<{
      projects: Array<{ path: string; name: string; lastOpened?: string }>;
    }>;
    getFromUrl: () => string | null;
    browse: () => Promise<{ path: string | null; canceled: boolean }>;
  };
  tab: {
    create: (
      type: 'todos' | 'kanban' | 'notes' | 'picker' | 'browser'
    ) => Promise<{ success: boolean }>;
    getType: () => 'project' | 'todos' | 'kanban' | 'notes' | 'picker' | 'browser' | 'home';
  };
  theme: {
    set: (theme: 'light' | 'dark' | 'system') => Promise<{ success: boolean }>;
    get: () => Promise<{ theme: string; shouldUseDarkColors: boolean }>;
  };
  browser: {
    getRecentUrls: () => Promise<GetRecentUrlsResponse>;
    addRecentUrl: (url: string, title?: string) => Promise<{ success: boolean }>;
    removeRecentUrl: (url: string) => Promise<{ success: boolean }>;
    clearRecentUrls: () => Promise<{ success: boolean }>;
  };
  window: {
    getId: () => Promise<{ windowId: string }>;
  };
  splits: {
    load: (windowId: string) => Promise<{ success: boolean; tree: unknown | null; error?: string }>;
    save: (
      windowId: string,
      tree: unknown
    ) => Promise<{ success: boolean; error?: string }>;
    delete: (windowId: string) => Promise<{ success: boolean; error?: string }>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
