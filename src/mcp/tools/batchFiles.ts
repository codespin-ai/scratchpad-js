// src/mcp/tools/batchFiles.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import * as fs from "fs";
import * as path from "path";
import {
  validateProjectName,
  validateFilePath,
  getProjectByName,
} from "../utils.js";

export function registerBatchFileTools(server: McpServer): void {
  server.tool(
    "write_batch_files",
    "Write content to multiple files in a project directory in a single operation",
    {
      projectName: zod.string().describe("The name of the project"),
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
    async ({ projectName, files, stopOnError }) => {
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

      const projectDir = project.hostPath;
      const results = [];
      let hasError = false;

      for (const fileOp of files) {
        const { filePath, content, mode = "overwrite" } = fileOp;

        try {
          if (!validateFilePath(projectDir, filePath)) {
            throw new Error(`Invalid file path: ${filePath}`);
          }

          const fullPath = path.join(projectDir, filePath);
          const dirPath = path.dirname(fullPath);

          // Ensure directory exists
          fs.mkdirSync(dirPath, { recursive: true });

          // Write file
          fs.writeFileSync(fullPath, content, {
            flag: mode === "append" ? "a" : "w",
            encoding: "utf8",
          });

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
      const formattedResults = results
        .map((result) => {
          return (
            `File: ${result.filePath}\n` +
            `Status: ${result.success ? "Success" : "Failed"}\n` +
            `Message: ${result.message}\n` +
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
