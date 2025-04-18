// src/mcp/tools/files.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import * as fs from "fs";
import * as path from "path";
import {
  validateProjectName,
  getProjectByName,
  validateFilePath,
} from "../utils.js";

export function registerFileTools(server: McpServer): void {
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

      if (!validateFilePath(projectDir, filePath)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Invalid file path: ${filePath}`,
            },
          ],
        };
      }

      const fullPath = path.join(projectDir, filePath);
      const dirPath = path.dirname(fullPath);

      try {
        // Ensure directory exists
        fs.mkdirSync(dirPath, { recursive: true });

        // Write file
        fs.writeFileSync(fullPath, content, {
          flag: mode === "append" ? "a" : "w",
          encoding: "utf8",
        });

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
