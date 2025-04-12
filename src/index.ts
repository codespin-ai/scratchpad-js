#!/usr/bin/env node
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as zod from "zod"; // Use the correct import syntax

// Convert exec to promise-based
const execAsync = promisify(exec);

// Get the current working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const currentDir = process.cwd();

// Parse command line arguments
const dockerImage = process.argv[2];
if (!dockerImage) {
  console.error("Usage: codebox <docker-image-name>");
  process.exit(1);
}

console.error(`Starting Codebox server with Docker image: ${dockerImage}`);
console.error(`Current directory: ${currentDir}`);

// Create the MCP server
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

// Register the execute_command tool
server.tool(
  "execute_command",
  "Execute a command in the Docker container",
  {
    command: zod.string().describe("The command to execute in the container"),
  },
  async ({ command }) => {
    console.error(`Executing command: ${command}`);

    try {
      // Execute the Docker command
      const dockerCommand = `docker run -i --rm -v "${currentDir}:/home/project" --workdir="/home/project" ${dockerImage} /bin/sh -c "${command.replace(
        /"/g,
        '\\"'
      )}"`;
      console.error(`Docker command: ${dockerCommand}`);

      const { stdout, stderr } = await execAsync(dockerCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer to handle large outputs
      });

      const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    } catch (error) {
      // Handle command execution errors
      console.error("Error executing command:", error);

      // For exec errors, we can get stderr which is more useful
      let errorMessage = "Unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
        // @ts-ignore - TypeScript doesn't know about the stdout/stderr properties
        if (error.stderr) {
          // @ts-ignore
          errorMessage += `\nSTDERR: ${error.stderr}`;
        }
      }

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Codebox server running. Waiting for commands...");
}

main().catch((error) => {
  console.error("Fatal server error:", error);
  process.exit(1);
});
