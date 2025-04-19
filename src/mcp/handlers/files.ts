// src/mcp/handlers/files.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import { writeProjectFile } from "../../fs/fileIO.js";
import { validateFilePath } from "../../fs/pathValidation.js";
import {
  getWorkingDirForProjectSession,
  projectSessionExists,
} from "../../projectSessions/projectSessionStore.js";

/**
 * Register file operation handlers with the MCP server
 */
export function registerFileHandlers(server: McpServer): void {
  server.tool(
    "write_file",
    "Write content to a file in a project directory using a project session",
    {
      projectSessionId: zod
        .string()
        .describe("The project session id from open_project_session"),
      filePath: zod
        .string()
        .describe("Relative path to the file from project root"),
      content: zod.string().describe("Content to write to the file"),
      mode: zod
        .enum(["overwrite", "append"])
        .default("overwrite")
        .describe("Write mode - whether to overwrite or append"),
    },
    async ({ projectSessionId, filePath, content, mode }) => {
      // Validate the project session
      if (!projectSessionExists(projectSessionId)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Invalid or expired project session id: ${projectSessionId}`,
            },
          ],
        };
      }

      // Get the working directory from the project session
      const workingDir = getWorkingDirForProjectSession(projectSessionId);
      if (!workingDir) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Session mapping not found: ${projectSessionId}`,
            },
          ],
        };
      }

      // Pre-validate the file path before attempting any operations
      if (!validateFilePath(workingDir, filePath)) {
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
        // Write file to the project session's working directory
        writeProjectFile(workingDir, filePath, content, mode);

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
