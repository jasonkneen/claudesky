import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { homedir, release, type, version } from 'os';
import { join } from 'path';
import { app, ipcMain } from 'electron';

import type {
  DiscoveredMcpServer,
  McpServerConfig,
  McpServersConfig,
  McpStdioServerConfig
} from '../../shared/types/ipc';
import {
  buildClaudeSessionEnv,
  buildEnhancedPath,
  ensureWorkspaceDir,
  getAnthropicBaseUrlStatus,
  getApiKeyStatus,
  getDebugMode,
  getHiddenDiscoveredServers,
  getMcpServerEnabled,
  getMcpServers,
  getMcpToolApprovals,
  getWorkspaceDir,
  hideDiscoveredServer,
  loadConfig,
  saveConfig,
  setAnthropicBaseUrl,
  setApiKey,
  setMcpServerEnabled,
  setMcpServers,
  setMcpToolApproval
} from '../lib/config';
import { discoverMcpServerTools } from '../lib/mcp-tool-discovery';

const requireModule = createRequire(import.meta.url);

function isStdioServerConfig(config: McpServerConfig): config is McpStdioServerConfig {
  return config.type === 'stdio' && typeof config.command === 'string';
}

/**
 * Resolves a command to its full path using 'which'.
 * If the command is already an absolute path, returns it as-is.
 * If resolution fails, returns the original command.
 * Uses the enhanced PATH to ensure we find executables from user's shell environment.
 */
function resolveCommandPath(command: string): string {
  // If already absolute path, return as-is
  if (command.startsWith('/') || command.startsWith('~')) {
    return command;
  }

  // Try to resolve using 'which' with enhanced PATH
  try {
    const enhancedPath = buildEnhancedPath();
    const fullPath = execSync(`which ${command}`, {
      encoding: 'utf-8',
      env: { ...process.env, PATH: enhancedPath }
    }).trim();
    return fullPath || command;
  } catch {
    // If which fails, return the original command
    return command;
  }
}

function getClaudeAgentSdkVersion(): string {
  try {
    // Try to resolve the SDK package.json
    const sdkPackagePath = requireModule.resolve('@anthropic-ai/claude-agent-sdk/package.json');

    // Handle app.asar unpacked case (production builds)
    let packagePath = sdkPackagePath;
    if (sdkPackagePath.includes('app.asar')) {
      const unpackedPath = sdkPackagePath.replace('app.asar', 'app.asar.unpacked');
      if (existsSync(unpackedPath)) {
        packagePath = unpackedPath;
      }
    }

    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      return packageJson.version || 'unknown';
    }
  } catch {
    // Fallback if we can't read the version
  }
  return 'unknown';
}

export function registerConfigHandlers(): void {
  // Get workspace directory
  ipcMain.handle('config:get-workspace-dir', () => {
    return { workspaceDir: getWorkspaceDir() };
  });

  // Set workspace directory
  ipcMain.handle('config:set-workspace-dir', async (_event, workspaceDir: string) => {
    const trimmedPath = workspaceDir.trim();
    if (!trimmedPath) {
      return { success: false, error: 'Workspace directory cannot be empty' };
    }

    const config = loadConfig();
    config.workspaceDir = trimmedPath;
    saveConfig(config);

    // Create the new workspace directory
    await ensureWorkspaceDir();

    return { success: true };
  });

  // Get debug mode
  ipcMain.handle('config:get-debug-mode', () => {
    return { debugMode: getDebugMode() };
  });

  // Set debug mode
  ipcMain.handle('config:set-debug-mode', (_event, debugMode: boolean) => {
    const config = loadConfig();
    config.debugMode = debugMode;
    saveConfig(config);
    return { success: true };
  });

  // API key status (env vs local config)
  ipcMain.handle('config:get-api-key-status', () => {
    return { status: getApiKeyStatus() };
  });

  // Set or clear API key stored in app config
  ipcMain.handle('config:set-api-key', (_event, apiKey?: string | null) => {
    const normalized = apiKey?.trim() || null;
    setApiKey(normalized);
    return { success: true, status: getApiKeyStatus() };
  });

  // Base URL status (env vs local config)
  ipcMain.handle('config:get-base-url-status', () => {
    return { status: getAnthropicBaseUrlStatus() };
  });

  // Set or clear base URL stored in app config
  ipcMain.handle('config:set-base-url', (_event, baseUrl?: string | null) => {
    const normalized = baseUrl?.trim() || null;
    setAnthropicBaseUrl(normalized);
    return { success: true, status: getAnthropicBaseUrlStatus() };
  });

  // Get Gemini API key
  ipcMain.handle('config:get-gemini-api-key', () => {
    const config = loadConfig();
    return { geminiApiKey: config.geminiApiKey || '' };
  });

  // Set Gemini API key
  ipcMain.handle('config:set-gemini-api-key', (_event, geminiApiKey?: string | null) => {
    const config = loadConfig();
    config.geminiApiKey = geminiApiKey?.trim() || undefined;
    saveConfig(config);
    return { success: true };
  });

  // Get PATH environment variable info (for debug/dev section)
  // Uses the enhanced PATH (same as Claude Agent SDK) for consistency
  ipcMain.handle('config:get-path-info', () => {
    const pathSeparator = process.platform === 'win32' ? ';' : ':';
    // Use enhanced PATH to match what Claude Agent SDK uses
    const enhancedPath = buildEnhancedPath();
    const pathEntries = enhancedPath.split(pathSeparator).filter((p) => p.trim());
    return {
      platform: process.platform,
      pathSeparator,
      pathEntries,
      pathCount: pathEntries.length,
      fullPath: enhancedPath
    };
  });

  // Get all environment variables (for debug/dev section)
  // Uses the same environment object as Claude Agent SDK query sessions for consistency
  // Masks sensitive variables like API keys, passwords, tokens, etc.
  ipcMain.handle('config:get-env-vars', () => {
    const sensitivePatterns = [
      /KEY/i,
      /SECRET/i,
      /PASSWORD/i,
      /TOKEN/i,
      /AUTH/i,
      /CREDENTIAL/i,
      /PRIVATE/i
    ];

    const maskValue = (key: string, value: string): string => {
      // Check if key matches any sensitive pattern
      const isSensitive = sensitivePatterns.some((pattern) => pattern.test(key));
      if (!isSensitive) {
        return value;
      }

      // Mask sensitive values
      if (value.length <= 8) {
        return '••••';
      }
      // Show first 4 and last 4 chars for longer values
      return `${value.slice(0, 4)}••••${value.slice(-4)}`;
    };

    // Use the same environment builder as Claude Agent SDK to ensure consistency
    const env = buildClaudeSessionEnv();

    const envVars: Array<{ key: string; value: string }> = [];
    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) {
        envVars.push({
          key,
          value: maskValue(key, value)
        });
      }
    }

    // Sort alphabetically by key
    envVars.sort((a, b) => a.key.localeCompare(b.key));

    return { envVars, count: envVars.length };
  });

  // Get app diagnostic metadata (versions, platform info, etc.)
  ipcMain.handle('config:get-diagnostic-metadata', () => {
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromiumVersion: process.versions.chrome,
      v8Version: process.versions.v8,
      nodeVersion: process.versions.node,
      claudeAgentSdkVersion: getClaudeAgentSdkVersion(),
      platform: process.platform,
      arch: process.arch,
      osRelease: release(),
      osType: type(),
      osVersion: version()
    };
  });

  // Get MCP servers configuration
  ipcMain.handle('config:get-mcp-servers', () => {
    return { mcpServers: getMcpServers() };
  });

  // Set MCP servers configuration
  ipcMain.handle('config:set-mcp-servers', (_event, mcpServers: McpServersConfig) => {
    console.log('Setting MCP servers:', mcpServers);
    try {
      setMcpServers(mcpServers);
      const saved = getMcpServers();
      console.log('MCP servers set successfully:', saved);
      return { success: true, mcpServers: saved };
    } catch (error) {
      console.error('Failed to set MCP servers:', error);
      return {
        success: false,
        mcpServers: getMcpServers(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Discover MCP servers from all sources (Claude Desktop, CLI, App)
  ipcMain.handle('config:discover-mcp-servers', async () => {
    const discovered: Record<string, DiscoveredMcpServer> = {};
    console.log('[MCP Discovery] Starting discovery process...');

    // 1. Read from Claude Desktop config
    try {
      const claudeDesktopConfigPath = join(
        homedir(),
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json'
      );
      console.log('[MCP Discovery] Checking Claude Desktop config at:', claudeDesktopConfigPath);
      if (existsSync(claudeDesktopConfigPath)) {
        console.log('[MCP Discovery] Claude Desktop config file exists');
        const content = readFileSync(claudeDesktopConfigPath, 'utf-8');
        const config = JSON.parse(content) as { mcpServers?: McpServersConfig };
        console.log('[MCP Discovery] Parsed config:', config);
        if (config.mcpServers) {
          console.log(
            '[MCP Discovery] Found',
            Object.keys(config.mcpServers).length,
            'Claude Desktop MCP servers'
          );
          (Object.entries(config.mcpServers) as [string, McpServerConfig][]).forEach(
            ([name, serverConfig]) => {
              console.log('[MCP Discovery] Processing Claude Desktop server:', name, serverConfig);
              // Resolve command paths for stdio servers
              let resolvedConfig: McpServerConfig = serverConfig;
              if (isStdioServerConfig(serverConfig)) {
                const originalCommand = serverConfig.command;
                const resolvedCommand = resolveCommandPath(serverConfig.command);
                console.log(
                  '[MCP Discovery] Resolved command for',
                  name,
                  ':',
                  originalCommand,
                  '->',
                  resolvedCommand
                );
                resolvedConfig = {
                  ...serverConfig,
                  command: resolvedCommand
                };
              }

              discovered[`${name} (Claude Desktop)`] = {
                source: 'claude-desktop',
                config: resolvedConfig
              };
              console.log('[MCP Discovery] Added to discovered:', `${name} (Claude Desktop)`);
            }
          );
        } else {
          console.log('[MCP Discovery] No mcpServers property found in Claude Desktop config');
        }
      } else {
        console.log('[MCP Discovery] Claude Desktop config file does not exist');
      }
    } catch (error) {
      console.error('[MCP Discovery] Failed to read Claude Desktop config:', error);
    }

    // 2. Read from project-level .mcp.json (Claude CLI)
    try {
      const workspaceDir = getWorkspaceDir();
      const projectMcpPath = join(workspaceDir, '.mcp.json');
      console.log('[MCP Discovery] Checking project config at:', projectMcpPath);
      if (existsSync(projectMcpPath)) {
        console.log('[MCP Discovery] Project config file exists');
        const content = readFileSync(projectMcpPath, 'utf-8');
        const config = JSON.parse(content) as { mcpServers?: McpServersConfig };
        if (config.mcpServers) {
          console.log(
            '[MCP Discovery] Found',
            Object.keys(config.mcpServers).length,
            'project MCP servers'
          );
          (Object.entries(config.mcpServers) as [string, McpServerConfig][]).forEach(
            ([name, serverConfig]) => {
              console.log('[MCP Discovery] Processing project server:', name);
              // Resolve command paths for stdio servers
              let resolvedConfig: McpServerConfig = serverConfig;
              if (isStdioServerConfig(serverConfig)) {
                resolvedConfig = {
                  ...serverConfig,
                  command: resolveCommandPath(serverConfig.command)
                };
              }

              discovered[`${name} (Project)`] = {
                source: 'project',
                config: resolvedConfig
              };
            }
          );
        }
      } else {
        console.log('[MCP Discovery] Project config file does not exist');
      }
    } catch (error) {
      console.error('[MCP Discovery] Failed to read project .mcp.json:', error);
    }

    // 3. Include app's own configured MCP servers
    try {
      console.log('[MCP Discovery] Checking app configured servers');
      const appMcpServers = getMcpServers();
      console.log('[MCP Discovery] App MCP servers:', appMcpServers);
      Object.entries(appMcpServers).forEach(([name, serverConfig]) => {
        console.log('[MCP Discovery] Processing app server:', name);
        discovered[`${name} (App)`] = {
          source: 'app',
          config: serverConfig
        };
      });
    } catch (error) {
      console.error('[MCP Discovery] Failed to get app MCP servers:', error);
    }

    console.log('[MCP Discovery] Total discovered servers:', Object.keys(discovered).length);
    console.log('[MCP Discovery] Discovered servers:', discovered);

    // Filter out hidden servers
    const hidden = getHiddenDiscoveredServers();
    console.log('[MCP Discovery] Hidden servers:', Array.from(hidden));
    for (const name of Object.keys(discovered)) {
      if (hidden.has(name)) {
        console.log('[MCP Discovery] Filtering out hidden server:', name);
        delete discovered[name];
      }
    }
    console.log('[MCP Discovery] After filtering hidden, total:', Object.keys(discovered).length);

    const discoveryEntries = Object.entries(discovered);
    await Promise.all(
      discoveryEntries.map(async ([displayName, info]) => {
        if (!info?.config) {
          return;
        }
        try {
          console.log('[MCP Discovery] Discovering tools for:', displayName);
          const result = await discoverMcpServerTools(displayName, info.config);
          if (result.tools?.length) {
            console.log('[MCP Discovery] Found', result.tools.length, 'tools for', displayName);
            info.tools = result.tools;
          }
          if (result.error) {
            console.log(
              '[MCP Discovery] Error discovering tools for',
              displayName,
              ':',
              result.error
            );
            info.error = result.error;
          }
        } catch (error) {
          console.log('[MCP Discovery] Exception discovering tools for', displayName, ':', error);
          info.error = error instanceof Error ? error.message : String(error);
        }
      })
    );

    console.log('[MCP Discovery] Discovery complete. Final result:', discovered);
    return { discovered };
  });

  // MCP Tool Approval Management
  ipcMain.handle('config:get-mcp-approvals', () => {
    const toolApprovals = getMcpToolApprovals();
    const serverEnabled = getMcpServerEnabled();
    return {
      approvals: {
        toolApprovals,
        serverEnabled
      }
    };
  });

  ipcMain.handle(
    'config:set-mcp-tool-approval',
    (_event, toolId: string, status: 'disabled' | 'enabled' | 'always_allowed') => {
      try {
        setMcpToolApproval(toolId, status);
        const toolApprovals = getMcpToolApprovals();
        const serverEnabled = getMcpServerEnabled();
        return {
          success: true,
          approvals: {
            toolApprovals,
            serverEnabled
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set tool approval'
        };
      }
    }
  );

  ipcMain.handle(
    'config:set-mcp-server-enabled',
    (_event, serverName: string, enabled: boolean) => {
      try {
        setMcpServerEnabled(serverName, enabled);
        const serverEnabled = getMcpServerEnabled();
        return {
          success: true,
          enabled: serverEnabled
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set server enabled status'
        };
      }
    }
  );

  ipcMain.handle('config:hide-discovered-server', (_event, serverName: string) => {
    try {
      hideDiscoveredServer(serverName);
      const hidden = getHiddenDiscoveredServers();
      return {
        success: true,
        hidden: Array.from(hidden)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to hide discovered server'
      };
    }
  });
}
