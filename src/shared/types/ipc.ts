// Shared IPC response types used by both main and renderer processes

export interface WorkspaceDirResponse {
  workspaceDir: string;
}

export interface SuccessResponse {
  success: boolean;
  error?: string;
}

export type ChatModelPreference = 'fast' | 'smart-sonnet' | 'smart-opus';
export type SmartModelVariant = 'sonnet' | 'opus';
export type ThinkingMode = 'off' | 'low' | 'medium' | 'high' | 'ultra';

export interface SerializedAttachmentPayload {
  name: string;
  mimeType: string;
  size: number;
  data: ArrayBuffer | Uint8Array;
}

export interface SendMessagePayload {
  text: string;
  attachments?: SerializedAttachmentPayload[];
}

export interface GetChatModelPreferenceResponse {
  preference: ChatModelPreference;
}

export interface SetChatModelPreferenceResponse extends SuccessResponse {
  preference: ChatModelPreference;
}

export interface GetThinkingModeResponse {
  mode: ThinkingMode;
}

export interface SetThinkingModeResponse extends SuccessResponse {
  mode: ThinkingMode;
}

export interface SavedAttachmentInfo {
  name: string;
  mimeType: string;
  size: number;
  savedPath: string;
  relativePath: string;
}

export interface SendMessageResponse {
  success: boolean;
  error?: string;
  attachments?: SavedAttachmentInfo[];
}

export interface ShellResponse {
  success: boolean;
  error?: string;
}

// OAuth types
export type AuthMode = 'max' | 'console';

export interface OAuthStartLoginResponse {
  success: boolean;
  authUrl?: string;
  verifier?: string;
  state?: string;
  error?: string;
}

export interface OAuthCompleteLoginResponse {
  success: boolean;
  mode?: 'oauth' | 'api-key';
  apiKey?: string;
  error?: string;
}

export interface OAuthStatusResponse {
  authenticated: boolean;
  expiresAt: number | null;
}

export interface OAuthAccessTokenResponse {
  success: boolean;
  accessToken?: string | null;
  error?: string;
}

// Config/Voice types
export interface GeminiApiKeyResponse {
  geminiApiKey: string;
}

export interface SetGeminiApiKeyResponse extends SuccessResponse {}

// MCP Server types
export type McpServerType = 'stdio' | 'sse' | 'http';

export interface McpStdioServerConfig {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpSSEServerConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

export interface McpHttpServerConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export type McpServerConfig = McpStdioServerConfig | McpSSEServerConfig | McpHttpServerConfig;

export interface McpServersConfig {
  [key: string]: McpServerConfig;
}

export interface DiscoveredMcpTool {
  name: string;
  displayName: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface GetMcpServersResponse {
  mcpServers: McpServersConfig;
}

export interface SetMcpServersResponse extends SuccessResponse {
  mcpServers: McpServersConfig;
}

export interface DiscoveredMcpServer {
  source: 'claude-desktop' | 'project' | 'app';
  config: McpServerConfig;
  tools?: DiscoveredMcpTool[];
  error?: string;
}

export interface DiscoverMcpServersResponse {
  discovered: Record<string, DiscoveredMcpServer>;
}

// MCP tool permission system
// - disabled: tool not available to agent
// - enabled: tool available, prompts user each time before use
// - always_allowed: tool available without prompts
export type McpToolPermission = 'disabled' | 'enabled' | 'always_allowed';

export interface McpToolApprovalState {
  [toolId: string]: McpToolPermission; // toolId = "serverName:toolName"
}

export interface McpServerEnabledState {
  [serverName: string]: boolean; // true = enabled, false = disabled
}

export interface McpApprovalConfig {
  toolApprovals: McpToolApprovalState;
  serverEnabled: McpServerEnabledState;
}

export interface GetMcpApprovalResponse {
  approvals: McpApprovalConfig;
}

export interface SetMcpToolApprovalResponse extends SuccessResponse {
  approvals: McpApprovalConfig;
}

export interface SetMcpServerEnabledResponse extends SuccessResponse {
  enabled: McpServerEnabledState;
}

export interface EnhancePromptResponse extends SuccessResponse {
  enhancedPrompt?: string;
}

// MCP Tool Approval Request (for 'enabled' tools that need per-use approval)
export interface McpToolApprovalRequest {
  toolId: string; // serverName:toolName
  toolDisplayName: string;
  serverName: string;
}

export type McpToolApprovalResponse = 'deny' | 'once' | 'always';
