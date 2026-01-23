import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPServerCapabilities {
  resources?: boolean;
  tools?: boolean;
  prompts?: boolean;
}

export class MCPClient {
  private client: Client;
  private transport: Transport | null = null;
  private connected = false;

  constructor() {
    this.client = new Client(
      {
        name: 'tony-rea',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
  }

  async connect(serverUrl: string, retries = 2): Promise<void> {
    if (this.connected) {
      await this.disconnect();
    }

    const url = new URL(serverUrl);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${retries}...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }

      // Try Streamable HTTP first (newer transport)
      try {
        this.transport = new StreamableHTTPClientTransport(url);
        await this.client.connect(this.transport);
        this.connected = true;
        console.log('Connected via Streamable HTTP transport');
        return;
      } catch (streamableError: any) {
        const errorMsg = streamableError?.message || String(streamableError);

        // Check if it's a server-side error (Cloudflare, 500, etc.)
        if (errorMsg.includes('1101') || errorMsg.includes('Worker threw') || errorMsg.includes('500')) {
          lastError = new Error(`MCP server error: The remote server is experiencing issues. Please try again later.`);
          console.log('Server-side error, will retry...', errorMsg.substring(0, 200));

          // Reset client for retry
          this.client = new Client(
            { name: 'tony-rea', version: '1.0.0' },
            { capabilities: {} }
          );
          continue;
        }

        console.log('Streamable HTTP failed, trying SSE transport...');

        // Reset client for new connection attempt
        this.client = new Client(
          { name: 'tony-rea', version: '1.0.0' },
          { capabilities: {} }
        );

        // Fall back to SSE transport for older servers
        try {
          this.transport = new SSEClientTransport(url);
          await this.client.connect(this.transport);
          this.connected = true;
          console.log('Connected via SSE transport');
          return;
        } catch (sseError: any) {
          lastError = new Error(`Failed to connect to MCP server. The server may not support MCP or is unavailable.`);
          console.log('SSE also failed:', sseError?.message?.substring(0, 200));

          // Reset client for retry
          this.client = new Client(
            { name: 'tony-rea', version: '1.0.0' },
            { capabilities: {} }
          );
        }
      }
    }

    throw lastError || new Error('Failed to connect to MCP server after retries');
  }

  async disconnect(): Promise<void> {
    if (this.connected && this.transport) {
      await this.client.close();
      this.connected = false;
      this.transport = null;
    }
  }

  getServerCapabilities(): MCPServerCapabilities {
    const caps = this.client.getServerCapabilities();
    return {
      resources: !!caps?.resources,
      tools: !!caps?.tools,
      prompts: !!caps?.prompts,
    };
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const result = await this.client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    }));
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const result = await this.client.callTool({ name, arguments: args });
    return result.content;
  }

  async listResources(): Promise<MCPResource[]> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const result = await this.client.listResources();
    return result.resources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }));
  }

  async readResource(uri: string): Promise<MCPResourceContent[]> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const result = await this.client.readResource({ uri });
    return result.contents.map((c) => ({
      uri: c.uri,
      mimeType: c.mimeType,
      text: 'text' in c ? c.text : undefined,
    }));
  }

  async fetchAllContent(serverUrl: string): Promise<{ resources: MCPResource[]; contents: Map<string, string> }> {
    await this.connect(serverUrl);

    try {
      const resources = await this.listResources();
      const contents = new Map<string, string>();

      // Fetch content from each resource
      for (const resource of resources) {
        try {
          const resourceContents = await this.readResource(resource.uri);
          for (const content of resourceContents) {
            if (content.text) {
              contents.set(resource.uri, content.text);
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch resource ${resource.uri}:`, error);
        }
      }

      return { resources, contents };
    } finally {
      await this.disconnect();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance
let mcpClient: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClient) {
    mcpClient = new MCPClient();
  }
  return mcpClient;
}
