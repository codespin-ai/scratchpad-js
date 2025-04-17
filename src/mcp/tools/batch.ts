// src/mcp/tools/batch.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import {
  executeInContainer,
  validateProjectName
} from "../utils.js";

export function registerBatchTools(server: McpServer): void {
  server.tool(
    "execute_batch_commands",
    "Execute multiple commands in sequence within a Docker container for a specific project",
    {
      commands: zod
        .array(zod.string())
        .describe("Array of commands to execute in sequence"),
      projectName: zod.string().describe("The name of the project"),
      stopOnError: zod
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to stop execution if a command fails"),
    },
    async ({ commands, projectName, stopOnError }) => {
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

      const results = [];
      let hasError = false;

      for (const command of commands) {
        try {
          const { stdout, stderr } = await executeInContainer(
            projectName,
            command
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
      const formattedResults = results
        .map((result) => {
          return (
            `Command: ${result.command}\n` +
            `Status: ${result.success ? "Success" : "Failed"}\n` +
            `Output:\n${result.output}\n` +
            "----------------------------------------\n"
          );
        })
        .join("\n");

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
