#!/usr/bin/env node
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as zod from "zod";
import * as fs from "node:fs";

// Convert exec to promise-based
const execAsync = promisify(exec);

console.error("Starting Codebox server");

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

// Main execution tool - requires both project directory and docker image
server.tool(
  "execute_command",
  "Execute a command in a Docker container for a specific project",
  {
    command: zod.string().describe("The command to execute in the container"),
    projectDir: zod
      .string()
      .describe("The absolute path to the project directory"),
    dockerImage: zod.string().describe("The Docker image to use for execution"),
  },
  async ({ command, projectDir, dockerImage }) => {
    // Validate project directory
    const resolvedPath = path.resolve(projectDir);
    if (!fs.existsSync(resolvedPath)) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: Project directory does not exist: ${resolvedPath}`,
          },
        ],
      };
    }

    console.error(
      `Executing command in ${resolvedPath} using image ${dockerImage}: ${command}`
    );

    try {
      // Execute the Docker command
      const dockerCommand = `docker run -i --rm -v "${resolvedPath}:/home/project" --workdir="/home/project" ${dockerImage} /bin/sh -c "${command.replace(
        /"/g,
        '\\"'
      )}"`;
      console.error(`Docker command: ${dockerCommand}`);

      const { stdout, stderr } = await execAsync(dockerCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
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

      let errorMessage = "Unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
        // @ts-ignore
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

// Tool to list available Docker images
server.tool(
  "list_docker_images",
  "List available Docker images on the system",
  {},
  async () => {
    try {
      const { stdout } = await execAsync(
        'docker images --format "{{.Repository}}:{{.Tag}}"'
      );

      const images = stdout.trim().split("\n").filter(Boolean);

      if (images.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No Docker images found on the system.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Available Docker images:\n\n${images.join("\n")}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error listing Docker images:", error);

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error listing Docker images: ${error}`,
          },
        ],
      };
    }
  }
);

// Tool to list available project directories
server.tool(
  "list_projects",
  "List available projects in a directory",
  {
    baseDir: zod.string().describe("Directory containing projects"),
  },
  async ({ baseDir }) => {
    try {
      const resolvedPath = path.resolve(baseDir);
      if (!fs.existsSync(resolvedPath)) {
        return {
          isError: true,
          content: [
            { type: "text", text: `Directory not found: ${resolvedPath}` },
          ],
        };
      }

      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      const projects = entries
        .filter((entry) => entry.isDirectory())
        .map((dir) => dir.name);

      return {
        content: [
          {
            type: "text",
            text: `Available projects in ${resolvedPath}:\n\n${projects.join(
              "\n"
            )}`,
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error listing projects: ${error}` }],
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
