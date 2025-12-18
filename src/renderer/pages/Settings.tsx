import { ArrowLeft, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import VoiceSettings from '@/components/VoiceSettings';
import { useTheme } from '@/contexts/ThemeContext';

import type {
  DiscoveredMcpServer,
  McpServerConfig,
  McpServersConfig,
  McpStdioServerConfig
} from '../../shared/types/ipc';

interface SettingsProps {
  onBack: () => void;
}

type ApiKeyStatus = {
  configured: boolean;
  source: 'env' | 'local' | null;
  lastFour: string | null;
};

type BaseUrlStatus = {
  configured: boolean;
  source: 'env' | 'local' | null;
  url: string | null;
};

type SettingsTab = 'api' | 'oauth' | 'voice' | 'themes' | 'mcp' | 'debug';

const isStdioServerConfig = (config: McpServerConfig): config is McpStdioServerConfig =>
  !config.type || config.type === 'stdio';

const formatServerDetails = (config: McpServerConfig) => {
  if (isStdioServerConfig(config)) {
    const args = config.args?.length ? ` ${config.args.join(' ')}` : '';
    return `Command: ${config.command}${args}`;
  }

  if (config.type === 'sse' || config.type === 'http') {
    return `URL: ${config.url}`;
  }

  return 'Unknown type';
};

function Settings({ onBack }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('api');

  const [debugMode, setDebugMode] = useState(false);
  const [isLoadingDebugMode, setIsLoadingDebugMode] = useState(true);
  const [isSavingDebugMode, setIsSavingDebugMode] = useState(false);

  const [isDebugExpanded, setIsDebugExpanded] = useState(false);
  const [isBaseUrlExpanded, setIsBaseUrlExpanded] = useState(false);
  const [pathInfo, setPathInfo] = useState<{
    platform: string;
    pathSeparator: string;
    pathEntries: string[];
    pathCount: number;
    fullPath: string;
  } | null>(null);
  const [isLoadingPathInfo, setIsLoadingPathInfo] = useState(false);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }> | null>(null);
  const [isLoadingEnvVars, setIsLoadingEnvVars] = useState(false);
  const [diagnosticMetadata, setDiagnosticMetadata] = useState<{
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
  } | null>(null);
  const [isLoadingDiagnosticMetadata, setIsLoadingDiagnosticMetadata] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({
    configured: false,
    source: null,
    lastFour: null
  });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [apiKeySaveState, setApiKeySaveState] = useState<'idle' | 'success' | 'error'>('idle');
  const [baseUrlStatus, setBaseUrlStatus] = useState<BaseUrlStatus>({
    configured: false,
    source: null,
    url: null
  });
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [isSavingBaseUrl, setIsSavingBaseUrl] = useState(false);
  const [baseUrlSaveState, setBaseUrlSaveState] = useState<'idle' | 'success' | 'error'>('idle');
  const [oauthStatus, setOAuthStatus] = useState<{
    authenticated: boolean;
    expiresAt: number | null;
  } | null>(null);
  const [oauthCode, setOAuthCode] = useState('');
  const [oauthVerifier, setOAuthVerifier] = useState('');
  const [oauthState, setOAuthState] = useState('');
  const [isOAuthLoginInProgress, setIsOAuthLoginInProgress] = useState(false);
  const [oauthLoginState, setOAuthLoginState] = useState<'idle' | 'success' | 'error'>('idle');
  const [oauthErrorMessage, setOAuthErrorMessage] = useState('');
  const [shouldCreateApiKey, setShouldCreateApiKey] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServersConfig>({});
  const [isLoadingMcpServers, setIsLoadingMcpServers] = useState(true);
  const [isSavingMcpServers, setIsSavingMcpServers] = useState(false);
  const [mcpSaveState, setMcpSaveState] = useState<'idle' | 'success' | 'error'>('idle');
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpCommand, setNewMcpCommand] = useState('');
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [newMcpType, setNewMcpType] = useState<'stdio' | 'sse' | 'http'>('stdio');
  const [discoveredServers, setDiscoveredServers] = useState<Record<string, DiscoveredMcpServer>>(
    {}
  );
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [disabledServers, setDisabledServers] = useState<Set<string>>(new Set());
  const [toolPermissions, setToolPermissions] = useState<
    Record<string, 'disabled' | 'enabled' | 'always-allowed'>
  >({});
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  useEffect(() => {
    // Load current debug mode
    window.electron.config
      .getDebugMode()
      .then((response) => {
        setDebugMode(response.debugMode);
        setIsLoadingDebugMode(false);
      })
      .catch(() => {
        setIsLoadingDebugMode(false);
      });

    // Load API key status
    window.electron.config
      .getApiKeyStatus()
      .then((response) => {
        setApiKeyStatus(response.status);
      })
      .catch(() => {
        // ignore - will show as not configured
      });

    // Load base URL status
    window.electron.config
      .getBaseUrlStatus()
      .then((response) => {
        setBaseUrlStatus(response.status);
      })
      .catch(() => {
        // ignore - will show as not configured
      });

    // Load OAuth status
    window.electron.oauth
      .getStatus()
      .then((response) => {
        setOAuthStatus(response);
      })
      .catch(() => {
        // ignore - will show as not authenticated
      });

    // Load MCP servers
    window.electron.config
      .getMcpServers()
      .then((response) => {
        setMcpServers(response.mcpServers);
        setIsLoadingMcpServers(false);
      })
      .catch(() => {
        setIsLoadingMcpServers(false);
      });

    // Auto-discover MCP servers from all sources (Claude Desktop, Project, App)
    window.electron.config
      .discoverMcpServers()
      .then((response) => {
        console.log('Auto-discovered MCP servers:', response.discovered);
        setDiscoveredServers(response.discovered);
      })
      .catch((error) => {
        console.error('Failed to auto-discover MCP servers:', error);
      });

    // Load MCP approvals
    window.electron.config
      .getMcpApprovals()
      .then((response) => {
        console.log('Loaded MCP approvals:', response.approvals);
        // Convert approval state to permission state for UI
        // Note: Backend uses 'always_allowed' with underscore, UI uses 'always-allowed' with hyphen
        const permissions: Record<string, 'disabled' | 'enabled' | 'always-allowed'> = {};
        Object.entries(response.approvals.toolApprovals).forEach(([toolId, status]) => {
          if (status === 'always_allowed') {
            permissions[toolId] = 'always-allowed';
          } else if (status === 'enabled') {
            permissions[toolId] = 'enabled';
          } else {
            permissions[toolId] = 'disabled';
          }
        });
        setToolPermissions(permissions);
        // Convert server enabled state to Set of DISABLED servers (default is enabled)
        const disabled = new Set(
          Object.entries(response.approvals.serverEnabled)
            .filter(([, enabled]) => enabled === false)
            .map(([name]) => name)
        );
        setDisabledServers(disabled);
      })
      .catch((error) => {
        console.error('Failed to load MCP approvals:', error);
      });
  }, []);

  const loadPathInfo = async () => {
    setIsLoadingPathInfo(true);
    try {
      const info = await window.electron.config.getPathInfo();
      setPathInfo(info);
    } catch {
      // Ignore errors
    } finally {
      setIsLoadingPathInfo(false);
    }
  };

  const loadEnvVars = async () => {
    setIsLoadingEnvVars(true);
    try {
      const response = await window.electron.config.getEnvVars();
      setEnvVars(response.envVars);
    } catch {
      // Ignore errors
    } finally {
      setIsLoadingEnvVars(false);
    }
  };

  const loadDiagnosticMetadata = async () => {
    setIsLoadingDiagnosticMetadata(true);
    try {
      const metadata = await window.electron.config.getDiagnosticMetadata();
      setDiagnosticMetadata(metadata);
    } catch {
      // Ignore errors
    } finally {
      setIsLoadingDiagnosticMetadata(false);
    }
  };

  useEffect(() => {
    // Load path info, env vars, and diagnostic metadata when debug section is expanded
    if (!isDebugExpanded) {
      return;
    }

    if (!pathInfo) {
      void loadPathInfo();
    }
    if (!envVars) {
      void loadEnvVars();
    }
    if (!diagnosticMetadata) {
      void loadDiagnosticMetadata();
    }
  }, [isDebugExpanded]);

  const handleDebugModeChange = async (newMode: boolean) => {
    setIsSavingDebugMode(true);
    setDebugMode(newMode);
    try {
      const response = await window.electron.config.setDebugMode(newMode);
      if (!response.success) {
        setDebugMode(!newMode);
      }
    } catch {
      setDebugMode(!newMode);
    } finally {
      setIsSavingDebugMode(false);
    }
  };

  const handleApiKeySave = async () => {
    setIsSavingApiKey(true);
    try {
      const response = await window.electron.config.setApiKey(apiKeyInput);
      if (response.success) {
        const statusResponse = await window.electron.config.getApiKeyStatus();
        setApiKeyStatus(statusResponse.status);
        setApiKeyInput('');
        setApiKeySaveState('success');
        setTimeout(() => setApiKeySaveState('idle'), 2000);
      } else {
        setApiKeySaveState('error');
        setTimeout(() => setApiKeySaveState('idle'), 3000);
      }
    } catch {
      setApiKeySaveState('error');
      setTimeout(() => setApiKeySaveState('idle'), 3000);
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleApiKeyClear = async () => {
    setIsSavingApiKey(true);
    try {
      const response = await window.electron.config.setApiKey(null);
      if (response.success) {
        const statusResponse = await window.electron.config.getApiKeyStatus();
        setApiKeyStatus(statusResponse.status);
        setApiKeySaveState('success');
        setTimeout(() => setApiKeySaveState('idle'), 2000);
      } else {
        setApiKeySaveState('error');
        setTimeout(() => setApiKeySaveState('idle'), 3000);
      }
    } catch {
      setApiKeySaveState('error');
      setTimeout(() => setApiKeySaveState('idle'), 3000);
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleBaseUrlSave = async () => {
    setIsSavingBaseUrl(true);
    try {
      const response = await window.electron.config.setBaseUrl(baseUrlInput);
      if (response.success) {
        const statusResponse = await window.electron.config.getBaseUrlStatus();
        setBaseUrlStatus(statusResponse.status);
        setBaseUrlInput('');
        setBaseUrlSaveState('success');
        setTimeout(() => setBaseUrlSaveState('idle'), 2000);
      } else {
        setBaseUrlSaveState('error');
        setTimeout(() => setBaseUrlSaveState('idle'), 3000);
      }
    } catch {
      setBaseUrlSaveState('error');
      setTimeout(() => setBaseUrlSaveState('idle'), 3000);
    } finally {
      setIsSavingBaseUrl(false);
    }
  };

  const handleBaseUrlClear = async () => {
    setIsSavingBaseUrl(true);
    try {
      const response = await window.electron.config.setBaseUrl(null);
      if (response.success) {
        const statusResponse = await window.electron.config.getBaseUrlStatus();
        setBaseUrlStatus(statusResponse.status);
        setBaseUrlSaveState('success');
        setTimeout(() => setBaseUrlSaveState('idle'), 2000);
      } else {
        setBaseUrlSaveState('error');
        setTimeout(() => setBaseUrlSaveState('idle'), 3000);
      }
    } catch {
      setBaseUrlSaveState('error');
      setTimeout(() => setBaseUrlSaveState('idle'), 3000);
    } finally {
      setIsSavingBaseUrl(false);
    }
  };

  const handleOAuthLogin = async () => {
    setIsOAuthLoginInProgress(true);
    setOAuthErrorMessage('');
    setOAuthCode('');
    setOAuthVerifier('');
    setOAuthState('');
    try {
      const response = await window.electron.oauth.startLogin('console');
      if (response.success && response.authUrl && response.verifier && response.state) {
        // Store verifier and state for use when completing login
        setOAuthVerifier(response.verifier);
        setOAuthState(response.state);
        console.log('[OAuth] Login started, verifier and state stored');
      } else {
        setOAuthLoginState('error');
        setOAuthErrorMessage(response.error || 'Failed to start login');
        setTimeout(() => setOAuthLoginState('idle'), 3000);
        setIsOAuthLoginInProgress(false);
      }
    } catch (error) {
      setOAuthLoginState('error');
      setOAuthErrorMessage(error instanceof Error ? error.message : 'Login failed');
      setTimeout(() => setOAuthLoginState('idle'), 3000);
      setIsOAuthLoginInProgress(false);
    }
  };

  const handleOAuthLogout = async () => {
    try {
      const response = await window.electron.oauth.logout();
      if (response.success) {
        setOAuthStatus({ authenticated: false, expiresAt: null });
        setOAuthLoginState('success');
        setTimeout(() => setOAuthLoginState('idle'), 2000);
      } else {
        setOAuthLoginState('error');
        setTimeout(() => setOAuthLoginState('idle'), 3000);
      }
    } catch {
      setOAuthLoginState('error');
      setTimeout(() => setOAuthLoginState('idle'), 3000);
    }
  };

  const handleOAuthCodeSubmit = async () => {
    if (!oauthCode.trim()) return;
    if (!oauthVerifier || !oauthState) {
      setOAuthErrorMessage('OAuth session expired. Please click Login again.');
      return;
    }

    setOAuthErrorMessage('');
    try {
      const response = await window.electron.oauth.completeLogin(
        oauthCode.trim(),
        oauthVerifier,
        oauthState,
        shouldCreateApiKey
      );
      if (response.success) {
        setOAuthLoginState('success');
        setOAuthCode('');
        setOAuthVerifier('');
        setOAuthState('');
        setIsOAuthLoginInProgress(false);
        const statusResponse = await window.electron.oauth.getStatus();
        setOAuthStatus(statusResponse);
        setTimeout(() => setOAuthLoginState('idle'), 2000);
      } else {
        setOAuthErrorMessage(response.error || 'Failed to complete login');
        setOAuthLoginState('error');
        setTimeout(() => setOAuthLoginState('idle'), 3000);
      }
    } catch (error) {
      setOAuthErrorMessage(error instanceof Error ? error.message : 'Failed to complete login');
      setOAuthLoginState('error');
      setTimeout(() => setOAuthLoginState('idle'), 3000);
    }
  };

  const handleCancelOAuth = async () => {
    await window.electron.oauth.cancel();
    setIsOAuthLoginInProgress(false);
    setOAuthCode('');
    setOAuthVerifier('');
    setOAuthState('');
    setOAuthErrorMessage('');
  };

  const handleAddMcpServer = async () => {
    if (
      !newMcpName.trim() ||
      (newMcpType === 'stdio' && !newMcpCommand.trim()) ||
      ((newMcpType === 'sse' || newMcpType === 'http') && !newMcpUrl.trim())
    ) {
      console.warn('MCP server name is empty');
      return;
    }

    const newServer: McpServerConfig =
      newMcpType === 'stdio' ? { type: 'stdio', command: newMcpCommand, args: [] }
      : newMcpType === 'sse' ? { type: 'sse', url: newMcpUrl }
      : { type: 'http', url: newMcpUrl };

    console.log('Adding new MCP server:', newServer);
    setIsSavingMcpServers(true);

    try {
      const response = await window.electron.config.setMcpServers({
        ...mcpServers,
        [newMcpName]: newServer
      });

      if (response.success) {
        console.log('MCP server added successfully:', response.mcpServers);
        setMcpServers(response.mcpServers);
        setNewMcpName('');
        setNewMcpCommand('');
        setNewMcpUrl('');
        setNewMcpType('stdio');
        setMcpSaveState('success');
        setTimeout(() => setMcpSaveState('idle'), 2000);
      } else {
        console.error('MCP server save failed:', response);
        setMcpSaveState('error');
        setTimeout(() => setMcpSaveState('idle'), 3000);
      }
    } catch (error) {
      console.error('Failed to save MCP server:', error);
      setMcpSaveState('error');
      setTimeout(() => setMcpSaveState('idle'), 3000);
    } finally {
      setIsSavingMcpServers(false);
    }
  };

  const handleDeleteMcpServer = async (serverName: string) => {
    setIsSavingMcpServers(true);
    try {
      const updated = { ...mcpServers };
      delete updated[serverName];
      const response = await window.electron.config.setMcpServers(updated);
      if (response.success) {
        setMcpServers(response.mcpServers);
        setMcpSaveState('success');
        setTimeout(() => setMcpSaveState('idle'), 2000);
      } else {
        setMcpSaveState('error');
        setTimeout(() => setMcpSaveState('idle'), 3000);
      }
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
      setMcpSaveState('error');
      setTimeout(() => setMcpSaveState('idle'), 3000);
    } finally {
      setIsSavingMcpServers(false);
    }
  };

  const handleDiscoverServers = async () => {
    console.log('Starting MCP server discovery');
    setIsDiscovering(true);
    try {
      const response = await window.electron.config.discoverMcpServers();
      console.log('Discovered MCP servers:', response.discovered);
      setDiscoveredServers(response.discovered);
    } catch (_error) {
      console.error('Failed to discover MCP servers:', _error);
    } finally {
      setIsDiscovering(false);
    }
  };

  const toggleServerEnabled = async (serverName: string) => {
    const newSet = new Set(disabledServers);
    // Currently disabled = in set, so toggling means:
    // If in set (disabled), remove to enable
    // If not in set (enabled), add to disable
    const isCurrentlyDisabled = newSet.has(serverName);
    const willBeEnabled = isCurrentlyDisabled; // If currently disabled, will be enabled after toggle

    if (isCurrentlyDisabled) {
      newSet.delete(serverName); // Enable it
    } else {
      newSet.add(serverName); // Disable it
    }
    setDisabledServers(newSet);
    // Save to config
    try {
      await window.electron.config.setMcpServerEnabled(serverName, willBeEnabled);
    } catch (error) {
      console.error('Failed to save server enabled state:', error);
    }
  };

  const handleHideDiscoveredServer = async (serverName: string) => {
    try {
      const response = await window.electron.config.hideDiscoveredServer(serverName);
      if (response.success) {
        // Remove from discovered servers display
        setDiscoveredServers((prev) => {
          const updated = { ...prev };
          delete updated[serverName];
          return updated;
        });
      }
    } catch (error) {
      console.error('Failed to hide discovered server:', error);
    }
  };

  const setToolPermission = async (
    toolId: string,
    permission: 'disabled' | 'enabled' | 'always-allowed'
  ) => {
    setToolPermissions((prev) => ({
      ...prev,
      [toolId]: permission
    }));
    setOpenPopover(null);
    // Save to config - convert UI hyphen format to backend underscore format
    try {
      const status = permission === 'always-allowed' ? 'always_allowed' : permission;
      await window.electron.config.setMcpToolApproval(toolId, status);
    } catch (error) {
      console.error('Failed to save tool approval:', error);
    }
  };

  const cycleToolState = async (toolId: string) => {
    const current = toolPermissions[toolId] || 'disabled';
    const next =
      current === 'disabled' ? 'enabled'
      : current === 'enabled' ? 'always-allowed'
      : 'disabled';
    await setToolPermission(toolId, next);
  };

  const isFormLoading = isLoadingDebugMode;
  const apiKeyPlaceholder = apiKeyStatus.lastFour ? `...${apiKeyStatus.lastFour}` : 'sk-ant-...';

  // Get theme context
  const { currentTheme, setTheme, themes } = useTheme();

  // Tab definitions
  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'api', label: 'API Configuration' },
    { id: 'oauth', label: 'OAuth' },
    { id: 'voice', label: 'Voice' },
    { id: 'themes', label: 'Themes' },
    { id: 'mcp', label: 'MCP Servers' },
    { id: 'debug', label: 'Debug' }
  ];

  return (
    <div className="flex h-screen flex-col bg-linear-to-b from-neutral-50 via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      {/* Header */}
      <div className="fixed top-0 right-0 left-0 z-50 h-12 border-b border-neutral-200/80 bg-white/80 backdrop-blur [-webkit-app-region:drag] dark:border-neutral-800 dark:bg-neutral-900/70">
        <div className="flex h-12 items-center justify-between px-6">
          <div />
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Settings</h1>
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg border border-neutral-200/80 bg-white/80 px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors [-webkit-app-region:no-drag] hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:text-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      {/* Main content - Header + Sidebar + Panel */}
      <div className="flex flex-1 overflow-hidden pt-[48px]">
        {/* Sidebar */}
        <div className="w-48 border-r border-neutral-200/80 bg-neutral-50/50 [-webkit-app-region:no-drag] dark:border-neutral-800 dark:bg-neutral-950/50">
          <nav className="flex flex-col gap-1 p-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2.5 text-left text-sm font-medium transition-all ${
                  activeTab === tab.id ?
                    'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50'
                  : 'text-neutral-700 hover:bg-white/50 dark:text-neutral-300 dark:hover:bg-neutral-800/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-y-auto px-8 py-8 [-webkit-app-region:no-drag]">
          <div className="mx-auto max-w-2xl">
            {isFormLoading ?
              <div className="flex items-center justify-center py-12 text-sm text-neutral-500 dark:text-neutral-400">
                Loading settings...
              </div>
            : <div className="space-y-8">
                {/* API Configuration Tab */}
                {activeTab === 'api' && (
                  <div className="space-y-8">
                    {/* API Key Section */}
                    <section className="space-y-4">
                      <div>
                        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                          Anthropic API Key
                        </h2>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                          Set an API key locally or use the <code>ANTHROPIC_API_KEY</code>{' '}
                          environment variable.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              apiKeyStatus.configured ?
                                'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {apiKeyStatus.configured ? '✓ Configured' : '✗ Not configured'}
                          </span>
                          {apiKeyStatus.configured && (
                            <span className="rounded-full bg-neutral-200/50 px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">
                              {apiKeyStatus.source}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          API Key
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder={apiKeyPlaceholder}
                            className="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900 placeholder-neutral-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50 dark:placeholder-neutral-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                          />
                          <button
                            onClick={handleApiKeySave}
                            disabled={isSavingApiKey || !apiKeyInput.trim()}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
                          >
                            {isSavingApiKey ? 'Saving...' : 'Set'}
                          </button>
                          {apiKeyStatus.configured && (
                            <button
                              onClick={handleApiKeyClear}
                              disabled={isSavingApiKey}
                              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {apiKeySaveState === 'success' && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            API key saved
                          </p>
                        )}
                        {apiKeySaveState === 'error' && (
                          <p className="text-xs text-red-600 dark:text-red-400">Failed to save</p>
                        )}
                      </div>
                    </section>

                    {/* Base URL Section */}
                    <section className="space-y-4">
                      <div>
                        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                          API Base URL
                        </h2>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                          Override the default Anthropic API endpoint (optional).
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              baseUrlStatus.configured ?
                                'text-green-600 dark:text-green-400'
                              : 'text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            {baseUrlStatus.configured ? '✓ Configured' : '○ Not set'}
                          </span>
                          {baseUrlStatus.configured && (
                            <span className="rounded-full bg-neutral-200/50 px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">
                              {baseUrlStatus.source}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          Base URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={baseUrlInput}
                            onChange={(e) => setBaseUrlInput(e.target.value)}
                            placeholder="https://api.anthropic.com"
                            className="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900 placeholder-neutral-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50 dark:placeholder-neutral-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                          />
                          <button
                            onClick={handleBaseUrlSave}
                            disabled={isSavingBaseUrl || !baseUrlInput.trim()}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
                          >
                            {isSavingBaseUrl ? 'Saving...' : 'Set'}
                          </button>
                          {baseUrlStatus.configured && (
                            <button
                              onClick={handleBaseUrlClear}
                              disabled={isSavingBaseUrl}
                              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {baseUrlSaveState === 'success' && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Base URL saved
                          </p>
                        )}
                        {baseUrlSaveState === 'error' && (
                          <p className="text-xs text-red-600 dark:text-red-400">Failed to save</p>
                        )}
                      </div>
                    </section>
                  </div>
                )}

                {/* OAuth Tab */}
                {activeTab === 'oauth' && (
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                        OAuth Authentication
                      </h2>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        Authenticate with your Anthropic account for extended capabilities.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-neutral-200/80 bg-white/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {oauthStatus?.authenticated ? 'Authenticated' : 'Not authenticated'}
                          </p>
                          {oauthStatus?.authenticated && oauthStatus.expiresAt && (
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              Expires: {new Date(oauthStatus.expiresAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {!isOAuthLoginInProgress && (
                          <button
                            onClick={
                              oauthStatus?.authenticated ? handleOAuthLogout : handleOAuthLogin
                            }
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                              oauthStatus?.authenticated ?
                                'border border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50/50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20'
                              : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700'
                            }`}
                          >
                            {oauthStatus?.authenticated ? 'Logout' : 'Login'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Code input section - shown when login is in progress */}
                    {isOAuthLoginInProgress && (
                      <div className="space-y-3 rounded-2xl border border-blue-200/80 bg-blue-50/30 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Paste Authorization Code
                          </p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            After authorizing in your browser, paste the code here to complete
                            login.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={oauthCode}
                            onChange={(e) => setOAuthCode(e.target.value)}
                            placeholder="Paste authorization code..."
                            className="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900 placeholder-neutral-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50 dark:placeholder-neutral-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleOAuthCodeSubmit();
                              }
                            }}
                          />
                          <button
                            onClick={handleOAuthCodeSubmit}
                            disabled={!oauthCode.trim()}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
                          >
                            Submit
                          </button>
                          <button
                            onClick={handleCancelOAuth}
                            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="createApiKey"
                            checked={shouldCreateApiKey}
                            onChange={(e) => setShouldCreateApiKey(e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800"
                          />
                          <label
                            htmlFor="createApiKey"
                            className="text-xs text-neutral-600 dark:text-neutral-400"
                          >
                            Create API key instead of OAuth tokens
                          </label>
                        </div>
                      </div>
                    )}

                    {oauthErrorMessage && (
                      <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
                        {oauthErrorMessage}
                      </p>
                    )}
                    {oauthLoginState === 'success' && (
                      <p className="rounded-lg bg-green-50 p-3 text-xs text-green-600 dark:bg-green-950/20 dark:text-green-400">
                        {oauthStatus?.authenticated ?
                          'Logged in successfully'
                        : 'Logged out successfully'}
                      </p>
                    )}
                  </section>
                )}

                {/* Voice Tab */}
                {activeTab === 'voice' && (
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                        Voice Settings
                      </h2>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        Configure voice input and output settings.
                      </p>
                    </div>
                    <VoiceSettings />
                  </section>
                )}

                {/* Themes Tab */}
                {activeTab === 'themes' && (
                  <section className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                        Appearance
                      </h2>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        Choose a theme to customize the app's appearance. Changes apply instantly.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {themes.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => setTheme(theme.id)}
                          className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                            currentTheme.id === theme.id ?
                              'border-blue-500 shadow-md'
                            : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600'
                          }`}
                        >
                          {/* Theme preview */}
                          <div
                            className="aspect-square bg-gradient-to-br p-4"
                            style={{
                              backgroundImage:
                                theme.colors ?
                                  `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`
                                : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
                            }}
                          >
                            <div className="space-y-2">
                              <div className="h-2 rounded bg-white/30" />
                              <div className="h-2 rounded bg-white/20" />
                              <div className="h-2 rounded bg-white/10" />
                            </div>
                          </div>

                          {/* Theme info */}
                          <div className="space-y-2 bg-white p-3 dark:bg-neutral-800">
                            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                              {theme.name}
                            </p>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400">
                              {theme.description}
                            </p>
                          </div>

                          {/* Selected indicator */}
                          {currentTheme.id === theme.id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm">
                              <div className="rounded-full bg-blue-500 p-1.5">
                                <svg
                                  className="h-4 w-4 text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* MCP Servers Tab */}
                {activeTab === 'mcp' && (
                  <section className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                        MCP Servers
                      </h2>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        Configure Model Context Protocol servers to extend Claude's capabilities.
                      </p>
                      <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                        <span className="font-semibold">Security note:</span> MCP tools execute
                        arbitrary code. Review each tool before enabling.
                      </p>
                    </div>

                    {/* Discovered Servers */}
                    {discoveredServers && Object.keys(discoveredServers).length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                            Discovered Servers ({Object.keys(discoveredServers).length})
                          </p>
                          <button
                            onClick={handleDiscoverServers}
                            disabled={isDiscovering}
                            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                          >
                            {isDiscovering ? 'Discovering...' : 'Refresh'}
                          </button>
                        </div>
                        {Object.entries(discoveredServers).map(([name, info]) => {
                          // Use base name without source suffix for enabled state
                          const baseName = name.split(' (')[0];
                          const isServerEnabled = !disabledServers.has(baseName);
                          return (
                            <div
                              key={name}
                              className={`rounded-xl border p-4 ${
                                isServerEnabled ?
                                  'border-blue-200/80 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/20'
                                : 'border-neutral-200/80 bg-neutral-50 opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                      {baseName}
                                    </p>
                                    <span className="rounded-full bg-neutral-900/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase dark:bg-neutral-50 dark:text-neutral-900">
                                      {info.source}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                    {formatServerDetails(info.config)}
                                  </p>
                                  {/* Tool chips */}
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {info.error ?
                                      <span className="rounded-md bg-red-100/60 px-2 py-1 text-[10px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-200">
                                        Discovery failed: {info.error}
                                      </span>
                                    : info.tools && info.tools.length > 0 ?
                                      info.tools.map((tool) => {
                                        const toolId = `${name}:${tool.name}`;
                                        const permission = toolPermissions[toolId] || 'disabled';
                                        const isOpen = openPopover === toolId;

                                        const chipStyles =
                                          permission === 'disabled' ?
                                            'bg-neutral-200/60 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                                          : permission === 'enabled' ?
                                            'bg-blue-200/60 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                          : 'bg-green-200/60 text-green-700 dark:bg-green-900/40 dark:text-green-300';

                                        return (
                                          <div key={tool.name} className="relative">
                                            <div className="inline-flex items-center">
                                              <button
                                                onClick={() => cycleToolState(toolId)}
                                                className={`inline-flex items-center gap-1.5 rounded-l-md px-2 py-1 text-[10px] font-medium transition-colors hover:opacity-80 ${chipStyles}`}
                                                title={`${tool.displayName} (${permission}) - click to cycle`}
                                              >
                                                <span>{tool.displayName}</span>
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenPopover(isOpen ? null : toolId);
                                                }}
                                                className={`inline-flex items-center justify-center rounded-r-md px-1 py-1 text-[10px] transition-colors hover:opacity-80 ${chipStyles}`}
                                                title="Show options"
                                              >
                                                <svg
                                                  className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                                  />
                                                </svg>
                                              </button>
                                            </div>

                                            {isOpen && (
                                              <div className="absolute top-full left-0 z-50 mt-1 rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                                                <button
                                                  onClick={() =>
                                                    setToolPermission(toolId, 'disabled')
                                                  }
                                                  className={`block w-full px-3 py-2 text-left text-xs font-medium transition-colors ${
                                                    permission === 'disabled' ?
                                                      'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50'
                                                    : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
                                                  }`}
                                                >
                                                  Disabled
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    setToolPermission(toolId, 'enabled')
                                                  }
                                                  className={`block w-full px-3 py-2 text-left text-xs font-medium transition-colors ${
                                                    permission === 'enabled' ?
                                                      'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200'
                                                    : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
                                                  }`}
                                                >
                                                  Enabled
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    setToolPermission(toolId, 'always-allowed')
                                                  }
                                                  className={`block w-full px-3 py-2 text-left text-xs font-medium transition-colors ${
                                                    permission === 'always-allowed' ?
                                                      'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200'
                                                    : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
                                                  }`}
                                                >
                                                  Always Allowed
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    : <span className="rounded-md bg-neutral-200/60 px-2 py-1 text-[10px] font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                                        Tools unavailable
                                      </span>
                                    }
                                  </div>
                                </div>
                                {/* Enable/Disable toggle and delete button for discovered server */}
                                <div className="flex shrink-0 gap-2">
                                  <button
                                    onClick={() => toggleServerEnabled(baseName)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent px-0.5 transition-colors ${
                                      isServerEnabled ?
                                        'bg-blue-600 dark:bg-blue-600'
                                      : 'bg-neutral-300 dark:bg-neutral-600'
                                    }`}
                                    role="switch"
                                    aria-checked={isServerEnabled}
                                    title={isServerEnabled ? 'Disable server' : 'Enable server'}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition ${
                                        isServerEnabled ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                  <button
                                    onClick={() => handleHideDiscoveredServer(name)}
                                    className="rounded-lg border border-red-200 p-2 text-red-600 transition-colors hover:border-red-300 hover:bg-red-50/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                                    title="Hide server"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* App Configuration */}
                    {isLoadingMcpServers ?
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Loading MCP servers...
                      </p>
                    : Object.keys(mcpServers).length > 0 ?
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                          Configured Servers ({Object.keys(mcpServers).length})
                        </p>
                        {Object.entries(mcpServers).map(([name, config]) => {
                          const isEnabled = !disabledServers.has(name);
                          return (
                            <div
                              key={name}
                              className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 ${
                                isEnabled ?
                                  'border-blue-200/80 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/20'
                                : 'border-neutral-200/80 bg-neutral-50 opacity-60 dark:border-neutral-800 dark:bg-neutral-900/50'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                  {name}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {formatServerDetails(config)}
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  onClick={() => toggleServerEnabled(name)}
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent px-0.5 transition-colors ${
                                    isEnabled ?
                                      'bg-blue-600 dark:bg-blue-600'
                                    : 'bg-neutral-300 dark:bg-neutral-600'
                                  }`}
                                  role="switch"
                                  aria-checked={isEnabled}
                                  title={isEnabled ? 'Disable server' : 'Enable server'}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition ${
                                      isEnabled ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                                <button
                                  onClick={() => handleDeleteMcpServer(name)}
                                  disabled={isSavingMcpServers}
                                  className="rounded-lg border border-red-200 p-2 text-red-600 transition-colors hover:border-red-300 hover:bg-red-50/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                                  title="Delete server"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    : <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        No MCP servers configured
                      </p>
                    }

                    {/* Add New Server */}
                    <div className="space-y-3 rounded-xl border border-neutral-200/80 bg-white/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        Add New Server
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            Server Name
                          </label>
                          <input
                            type="text"
                            value={newMcpName}
                            onChange={(e) => setNewMcpName(e.target.value)}
                            placeholder="e.g., my-mcp-server"
                            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            Server Type
                          </label>
                          <select
                            value={newMcpType}
                            onChange={(e) =>
                              setNewMcpType(e.target.value as 'stdio' | 'sse' | 'http')
                            }
                            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
                          >
                            <option value="stdio">Stdio</option>
                            <option value="sse">SSE</option>
                            <option value="http">HTTP</option>
                          </select>
                        </div>
                        {newMcpType === 'stdio' && (
                          <div>
                            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                              Command
                            </label>
                            <input
                              type="text"
                              value={newMcpCommand}
                              onChange={(e) => setNewMcpCommand(e.target.value)}
                              placeholder="e.g., python3"
                              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
                            />
                          </div>
                        )}
                        {(newMcpType === 'sse' || newMcpType === 'http') && (
                          <div>
                            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                              URL
                            </label>
                            <input
                              type="text"
                              value={newMcpUrl}
                              onChange={(e) => setNewMcpUrl(e.target.value)}
                              placeholder="e.g., https://example.com"
                              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
                            />
                          </div>
                        )}
                        <button
                          onClick={handleAddMcpServer}
                          disabled={isSavingMcpServers}
                          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-opacity hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingMcpServers ? 'Adding...' : 'Add Server'}
                        </button>
                        {mcpSaveState === 'success' && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Server added successfully
                          </p>
                        )}
                        {mcpSaveState === 'error' && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            Failed to add server
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* Debug Tab */}
                {activeTab === 'debug' && (
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                        Debug Settings
                      </h2>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        Advanced settings and diagnostics for troubleshooting.
                      </p>
                    </div>

                    {/* Debug Mode */}
                    <div className="rounded-xl border border-neutral-200/80 bg-white/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Debug Mode
                          </p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            Enable verbose logging and debug output
                          </p>
                        </div>
                        <button
                          onClick={() => handleDebugModeChange(!debugMode)}
                          disabled={isSavingDebugMode}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent px-0.5 transition-colors ${
                            debugMode ?
                              'bg-blue-600 dark:bg-blue-600'
                            : 'bg-neutral-300 dark:bg-neutral-600'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                          role="switch"
                          aria-checked={debugMode}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition ${
                              debugMode ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Diagnostics */}
                    <div className="space-y-3">
                      <button
                        onClick={() => setIsDebugExpanded(!isDebugExpanded)}
                        className="flex w-full items-center justify-between rounded-xl border border-neutral-200/80 bg-white/50 p-4 transition-colors hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/30 dark:hover:bg-neutral-900/50"
                      >
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          System Diagnostics
                        </span>
                        {isDebugExpanded ?
                          <ChevronUp className="h-5 w-5 text-neutral-400" />
                        : <ChevronDown className="h-5 w-5 text-neutral-400" />}
                      </button>

                      {isDebugExpanded && (
                        <div className="space-y-3">
                          {/* Path Info */}
                          <div className="rounded-lg border border-neutral-200/80 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/30">
                            <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                              PATH Information
                            </p>
                            {isLoadingPathInfo ?
                              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                Loading...
                              </p>
                            : pathInfo ?
                              <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                                <p>Platform: {pathInfo.platform}</p>
                                <p>Entries: {pathInfo.pathCount}</p>
                                <details className="cursor-pointer">
                                  <summary className="font-medium">Full PATH</summary>
                                  <pre className="mt-1 overflow-auto rounded bg-white p-2 text-[10px] dark:bg-neutral-800">
                                    {pathInfo.fullPath}
                                  </pre>
                                </details>
                              </div>
                            : <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                Failed to load path info
                              </p>
                            }
                          </div>

                          {/* Environment Variables */}
                          <div className="rounded-lg border border-neutral-200/80 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/30">
                            <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                              Environment Variables
                            </p>
                            {isLoadingEnvVars ?
                              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                Loading...
                              </p>
                            : envVars ?
                              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                                {envVars.map((v) => (
                                  <div key={v.key}>
                                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                                      {v.key}
                                    </span>
                                    ={v.value}
                                  </div>
                                ))}
                              </div>
                            : <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                Failed to load environment variables
                              </p>
                            }
                          </div>

                          {/* Metadata */}
                          <div className="rounded-lg border border-neutral-200/80 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/30">
                            <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                              System Metadata
                            </p>
                            {isLoadingDiagnosticMetadata ?
                              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                Loading...
                              </p>
                            : diagnosticMetadata ?
                              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-neutral-600 dark:text-neutral-400">
                                <div>
                                  <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                                    App
                                  </p>
                                  <p>{diagnosticMetadata.appVersion}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                                    Electron
                                  </p>
                                  <p>{diagnosticMetadata.electronVersion}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                                    Platform
                                  </p>
                                  <p>{diagnosticMetadata.platform}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                                    OS
                                  </p>
                                  <p>{diagnosticMetadata.osType}</p>
                                </div>
                              </div>
                            : <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                Failed to load diagnostic metadata
                              </p>
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
