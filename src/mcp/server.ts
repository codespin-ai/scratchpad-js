// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFileTools } from "./tools/files.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerExecuteTools } from "./tools/execute.js";
import { registerBatchTools } from "./tools/batch.js";
import { registerBatchFileTools } from "./tools/batchFiles.js";
import { addLoggingToServer } from "./loggingWrapper.js";
import { isDebugEnabled } from "../utils/logger.js";

export async function createServer(): Promise<McpServer> {
  // Create either a regular or logging-enabled server based on the server type
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

  // If debug mode is enabled, add logging
  const serverWithLogging = isDebugEnabled() ? addLoggingToServer(server) : server;

  // Register all tools
  registerFileTools(serverWithLogging);
  registerProjectTools(serverWithLogging);
  registerExecuteTools(serverWithLogging);
  registerBatchTools(serverWithLogging);
  registerBatchFileTools(serverWithLogging);

  return serverWithLogging;
}

export async function startServer(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Codebox MCP server running. Waiting for commands...");
}