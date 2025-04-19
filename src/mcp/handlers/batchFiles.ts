// src/mcp/handlers/batchFiles.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import { writeProjectFile } from "../../fs/fileIO.js";
import { validateFilePath } from "../../fs/pathValidation.js";
import {
  getWorkingDirForProjectSession,
  projectSessionExists,
} from "../../projectSessions/projectSessionStore.js";

/**
 * Format batch operation results for output
 */
function formatResults(
  results: {
    filePath: string;
    success: boolean;
    message: string;
  }[]
): string {
  return results
    .map((result) => {
      return (
        `File: ${result.filePath}\n` +
        `Status: ${result.success ? "Success" : "Failed"}\n` +
        `Message: ${result.message}\n` +
        "----------------------------------------\n"
      );
    })
    .join("\n");
}

/**
 * Register batch file operation handlers with the MCP server
 */
export function registerBatchFileHandlers(server: McpServer): void {
  server.tool(
    "write_batch_files",
    "Write content to multiple files in a project directory using a project session",
    {
      projectSessionId: zod
        .string()
        .describe("The project session id from open_project_session"),
      files: zod
        .array(
          zod.object({
            filePath: zod
              .string()
              .describe("Relative path to the file from project root"),
            content: zod.string().describe("Content to write to the file"),
            mode: zod
              .enum(["overwrite", "append"])
              .default("overwrite")
              .describe("Write mode - whether to overwrite or append"),
          })
        )
        .describe("Array of file operations to perform"),
      stopOnError: zod
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to stop execution if a file write fails"),
    },
    async ({ projectSessionId, files, stopOnError }) => {
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

      const results = [];
      let hasError = false;

      // First, validate all file paths before performing any writes
      // This prevents partial writes when some paths are valid and others aren't
      const validatedFiles = [];
      for (const fileOp of files) {
        const { filePath } = fileOp;

        if (!validateFilePath(workingDir, filePath)) {
          hasError = true;
          results.push({
            filePath,
            success: false,
            message: `Invalid file path: ${filePath} - path traversal attempt detected`,
          });

          if (stopOnError) {
            // Return early with error
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: formatResults(results),
                },
              ],
            };
          }
        } else {
          validatedFiles.push(fileOp);
        }
      }

      // Only proceed with writing validated files
      for (const fileOp of validatedFiles) {
        const { filePath, content, mode = "overwrite" } = fileOp;

        try {
          // Write the file to the project session's working directory
          writeProjectFile(workingDir, filePath, content, mode);

          results.push({
            filePath,
            success: true,
            message: `Successfully ${
              mode === "append" ? "appended to" : "wrote"
            } file`,
          });
        } catch (error) {
          hasError = true;
          results.push({
            filePath,
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          });

          // Stop if stopOnError is true
          if (stopOnError) {
            break;
          }
        }
      }

      // Format the results
      const formattedResults = formatResults(results);

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
