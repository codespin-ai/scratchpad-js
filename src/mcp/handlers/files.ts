// src/mcp/handlers/files.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import {
  getProjectByName,
  validateProjectName,
} from "../../config/projectConfig.js";
import { writeProjectFile } from "../../fs/fileIO.js";
import { validateFilePath } from "../../fs/pathValidation.js";

/**
 * Register file operation handlers with the MCP server
 */
export function registerFileHandlers(server: McpServer): void {
  server.tool(
    "write_file",
    "Write content to a file in a project directory",
    {
      projectName: zod.string().describe("The name of the project"),
      filePath: zod
        .string()
        .describe("Relative path to the file from project root"),
      content: zod.string().describe("Content to write to the file"),
      mode: zod
        .enum(["overwrite", "append"])
        .default("overwrite")
        .describe("Write mode - whether to overwrite or append"),
    },
    async ({ projectName, filePath, content, mode }) => {
      // Validate project first
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

      const project = getProjectByName(projectName);
      if (!project) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Project not found: ${projectName}`,
            },
          ],
        };
      }

      // Pre-validate the file path before attempting any operations
      if (!validateFilePath(project.hostPath, filePath)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Invalid file path: ${filePath} - path traversal attempt detected`,
            },
          ],
        };
      }

      try {
        // Write file to the project directory (which will perform validation again)
        writeProjectFile(project.hostPath, filePath, content, mode);

        return {
          content: [
            {
              type: "text",
              text: `Successfully ${
                mode === "append" ? "appended to" : "wrote"
              } file: ${filePath}`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error writing file: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }
  );
}
