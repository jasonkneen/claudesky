import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getDisplayName } from '@modelcontextprotocol/sdk/shared/metadataUtils.js';
import { app } from 'electron';

import type {
  DiscoveredMcpTool,
  McpHttpServerConfig,
  McpServerConfig,
  McpSSEServerConfig,
  McpStdioServerConfig
} from '../../shared/types/ipc';

const TOOL_DISCOVERY_TIMEOUT_MS = 5_000;

/**
 * Normalize JSON Schema from draft-07 to draft-2020-12.
 *
 * Many MCP servers use the TypeScript SDK which outputs draft-07 schemas,
 * but Claude API requires draft-2020-12. Key transformations:
 * - items (array) -> prefixItems (for tuple validation)
 * - additionalItems -> items (when prefixItems is used)
 * - $schema URL update
 *
 * See: https://github.com/modelcontextprotocol/typescript-sdk/issues/745
 */
function normalizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    // Update $schema to draft-2020-12
    if (key === '$schema') {
      if (typeof value === 'string' && value.includes('draft-07')) {
        normalized[key] = 'https://json-schema.org/draft/2020-12/schema';
      } else {
        normalized[key] = value;
      }
      continue;
    }

    // Transform tuple validation: items (array) -> prefixItems
    if (key === 'items' && Array.isArray(value)) {
      // In draft-07, items as array means tuple validation
      // In draft-2020-12, this is prefixItems
      normalized['prefixItems'] = value.map((item) =>
        typeof item === 'object' && item !== null ?
          normalizeSchema(item as Record<string, unknown>)
        : item
      );
      // If there's no additionalItems, set items to false (no additional items allowed)
      if (!('additionalItems' in schema)) {
        normalized['items'] = false;
      }
      continue;
    }

    // Transform additionalItems -> items (when used with tuple/prefixItems)
    if (key === 'additionalItems') {
      if (typeof value === 'boolean') {
        normalized['items'] = value;
      } else if (typeof value === 'object' && value !== null) {
        normalized['items'] = normalizeSchema(value as Record<string, unknown>);
      } else {
        normalized['items'] = value;
      }
      continue;
    }

    // Recursively normalize nested objects
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        normalized[key] = value.map((item) =>
          typeof item === 'object' && item !== null ?
            normalizeSchema(item as Record<string, unknown>)
          : item
        );
      } else {
        normalized[key] = normalizeSchema(value as Record<string, unknown>);
      }
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

export interface ToolDiscoveryResult {
  tools?: DiscoveredMcpTool[];
  error?: string;
}

export async function discoverMcpServerTools(
  serverName: string,
  config: McpServerConfig
): Promise<ToolDiscoveryResult> {
  try {
    const transport = createTransport(config);
    const client = new Client({
      name: 'claudesky',
      version: app.getVersion()
    });

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), TOOL_DISCOVERY_TIMEOUT_MS);

    try {
      await client.connect(transport, { signal: abortController.signal });
      const response = await client.listTools({}, { signal: abortController.signal });
      const tools: DiscoveredMcpTool[] = response.tools.map((tool) => {
        const displayName = getDisplayName(tool);

        // Normalize schema from draft-07 to draft-2020-12 if needed
        let inputSchema = tool.inputSchema as unknown as {
          type?: string;
          properties?: Record<string, unknown>;
          required?: string[];
        };

        if (inputSchema && typeof inputSchema === 'object') {
          inputSchema = normalizeSchema(
            inputSchema as Record<string, unknown>
          ) as typeof inputSchema;
        }

        return {
          name: tool.name,
          displayName: displayName ?? tool.name,
          description: tool.description,
          inputSchema
        };
      });

      return { tools };
    } finally {
      clearTimeout(timeoutId);
      await client.close().catch(() => undefined);
      if ('close' in transport && typeof transport.close === 'function') {
        await transport.close().catch(() => undefined);
      }
    }
  } catch (error) {
    return {
      error: formatError(serverName, error)
    };
  }
}

function createTransport(config: McpServerConfig) {
  if (!config.type || config.type === 'stdio') {
    const stdioConfig = config as McpStdioServerConfig;
    if (!stdioConfig.command) {
      throw new Error('Stdio MCP server is missing a command');
    }
    return new StdioClientTransport({
      command: stdioConfig.command,
      args: stdioConfig.args ?? [],
      env: stdioConfig.env,
      stderr: 'pipe'
    });
  }

  if (config.type === 'http') {
    const httpConfig = config as McpHttpServerConfig;
    if (!httpConfig.url) {
      throw new Error('HTTP MCP server is missing a url');
    }
    return new StreamableHTTPClientTransport(new URL(httpConfig.url), {
      requestInit: httpConfig.headers ? { headers: httpConfig.headers } : undefined
    });
  }

  if (config.type === 'sse') {
    const sseConfig = config as McpSSEServerConfig;
    if (!sseConfig.url) {
      throw new Error('SSE MCP server is missing a url');
    }
    return new SSEClientTransport(new URL(sseConfig.url), {
      requestInit: sseConfig.headers ? { headers: sseConfig.headers } : undefined
    });
  }

  throw new Error(`Unsupported MCP server type: ${(config as McpServerConfig).type}`);
}

function formatError(serverName: string, error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return `Timed out while connecting to ${serverName}`;
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return `Timed out while connecting to ${serverName}`;
    }
    return error.message;
  }
  return String(error);
}
