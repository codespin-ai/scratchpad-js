// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFileTools } from "./tools/files.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerExecuteTools } from "./tools/execute.js";

export async function createServer(): Promise<McpServer> {
  const server = new McpServer(
    {
      name: "codebox",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
    }
  );

  // Register all tools
  registerFileTools(server);
  registerProjectTools(server);
  registerExecuteTools(server);

  return server;
}

export async function startServer(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Codebox MCP server running. Waiting for commands...");
}
