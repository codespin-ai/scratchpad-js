// src/mcp/tools/batch.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import {
  validateProject,
  getDockerImage,
  executeInContainer,
} from "../utils.js";

export function registerBatchTools(server: McpServer): void {
  server.tool(
    "execute_batch_commands",
    "Execute multiple commands in sequence within a Docker container for a specific project",
    {
      commands: zod.array(zod.string()).describe("Array of commands to execute in sequence"),
      projectDir: zod
        .string()
        .describe("The absolute path to the project directory"),
      stopOnError: zod
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to stop execution if a command fails"),
    },
    async ({ commands, projectDir, stopOnError }) => {
      if (!validateProject(projectDir)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Invalid or unregistered project directory: ${projectDir}`,
            },
          ],
        };
      }

      const dockerImage = getDockerImage(projectDir);
      if (!dockerImage) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: No Docker image configured for this project. Run 'codebox init' in the project directory.`,
            },
          ],
        };
      }

      const results = [];
      let hasError = false;

      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        try {
          const { stdout, stderr } = await executeInContainer(
            projectDir,
            command,
            dockerImage
          );
          const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");
          
          // Add the command and its output to results
          results.push({
            command,
            output,
            success: true,
          });
        } catch (error) {
          hasError = true;
          results.push({
            command,
            output: error instanceof Error ? error.message : "Unknown error",
            success: false,
          });
          
          // Stop if stopOnError is true
          if (stopOnError) {
            break;
          }
        }
      }

      // Format the results
      const formattedResults = results.map(result => {
        return `Command: ${result.command}\n` +
               `Status: ${result.success ? 'Success' : 'Failed'}\n` +
               `Output:\n${result.output}\n` +
               "----------------------------------------\n";
      }).join("\n");

      return {
        isError: hasError && stopOnError,
        content: [
          {
            type: "text",
            text: formattedResults,
          },
        ],
      };
    }
  );
}