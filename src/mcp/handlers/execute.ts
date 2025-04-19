// src/mcp/handlers/execute.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import { validateProjectName } from "../../config/projectConfig.js";
import { executeDockerCommand } from "../../docker/execution.js";

/**
 * Register command execution handlers with the MCP server
 */
export function registerExecuteHandlers(server: McpServer): void {
  server.tool(
    "execute_command",
    "Execute a command in a Docker container for a specific project",
    {
      command: zod.string().describe("The command to execute in the container"),
      projectName: zod.string().describe("The name of the project"),
    },
    async ({ command, projectName }) => {
      if (!validateProjectName(projectName)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Invalid or unregistered project: ${projectName}`,
            },
          ],
        };
      }

      try {
        const { stdout, stderr } = await executeDockerCommand(
          projectName,
          command
        );
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
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error executing command: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }
  );
}