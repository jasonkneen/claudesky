import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import type { McpServerConfig, McpServersConfig } from '../../shared/types/ipc';
import {
  getHiddenDiscoveredServers,
  getMcpServerEnabled,
  getMcpServers,
  getWorkspaceDir,
  resolveCommandPath
} from './config';

/**
 * Validates and resolves an MCP server configuration.
 * Ensures required fields are present and resolves command paths for stdio servers.
 */
function validateAndResolveServer(server: McpServerConfig): McpServerConfig | null {
  if (!server) return null;

  // Default to stdio if type is missing
  const type = server.type || 'stdio';

  if (type === 'stdio') {
    // Validation: command is required
    if (!('command' in server) || typeof server.command !== 'string' || !server.command) {
      return null;
    }

    // Path Resolution
    return {
      ...server,
      command: resolveCommandPath(server.command)
    };
  }

  // Pass through other types (e.g. sse)
  return server;
}

export async function getMergedMcpServers(): Promise<McpServersConfig> {
  const merged: McpServersConfig = {};
  const hidden = getHiddenDiscoveredServers();
  const enabled = getMcpServerEnabled();
  console.log('Starting MCP server discovery');

  // Helper to process and merge a set of servers
  const mergeServers = (sourceName: string, servers: McpServersConfig | undefined) => {
    if (!servers) return;

    for (const [name, config] of Object.entries(servers)) {
      // Skip hidden servers - check both raw name and name with source suffix
      const nameWithSource = `${name} (${sourceName === 'Global Config' ? 'Claude Desktop' : sourceName})`;
      if (hidden.has(name) || hidden.has(nameWithSource)) {
        console.log(`Skipping hidden discovered server: ${name} (hidden as "${nameWithSource}")`);
        continue;
      }

      // Skip disabled servers - check enabled state
      // If enabled state is not explicitly set, default to true (enabled)
      const isEnabled = enabled[name] !== false;
      if (!isEnabled) {
        console.log(`Skipping disabled server: ${name} (disabled in settings)`);
        continue;
      }

      const resolved = validateAndResolveServer(config);
      if (resolved) {
        merged[name] = resolved;
      } else {
        console.warn(`Invalid MCP server configuration for '${name}' in ${sourceName}`);
      }
    }
  };

  // 1. Read from Claude Desktop config (Global)
  try {
    const claudeDesktopConfigPath = join(
      homedir(),
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json'
    );
    if (existsSync(claudeDesktopConfigPath)) {
      try {
        const content = readFileSync(claudeDesktopConfigPath, 'utf-8');
        const parsed = JSON.parse(content) as { mcpServers?: McpServersConfig };
        mergeServers('Global Config', parsed.mcpServers);
      } catch (parseError) {
        console.error(`Failed to parse Global config at ${claudeDesktopConfigPath}:`, parseError);
      }
    }
  } catch (error) {
    console.error('Failed to read Global config:', error);
  }

  // 2. Include app's own configured MCP servers (App)
  try {
    const appMcpServers = getMcpServers();
    mergeServers('App', appMcpServers);
  } catch (error) {
    console.error('Failed to get App config:', error);
  }

  // 3. Read from project-level .mcp.json (Project)
  try {
    const workspaceDir = getWorkspaceDir();
    const projectMcpPath = join(workspaceDir, '.mcp.json');
    if (existsSync(projectMcpPath)) {
      try {
        const content = readFileSync(projectMcpPath, 'utf-8');
        const parsed = JSON.parse(content) as { mcpServers?: McpServersConfig };
        mergeServers('Project', parsed.mcpServers);
      } catch (parseError) {
        console.error(`Failed to parse Project config at ${projectMcpPath}:`, parseError);
      }
    }
  } catch (error) {
    console.error('Failed to read Project config:', error);
  }

  console.log('Completed MCP server discovery:', merged);
  return merged;
}
