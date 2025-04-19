// src/mcp/handlers/projects.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import { getProjects } from "../../config/projectConfig.js";

/**
 * Register project-related handlers with the MCP server
 */
export function registerProjectHandlers(server: McpServer): void {
  server.tool(
    "list_projects",
    "List available projects",
    {},
    async () => {
      try {
        const projects = getProjects();

        if (projects.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No projects are registered. Use 'codebox project add <dirname> --image <image_name>' to add projects.",
              },
            ],
          };
        }

        // Extract only project names for output
        const projectNames = projects.map((project) => project.name);

        return {
          content: [
            {
              type: "text",
              text: projectNames.join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing projects: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }
  );
}