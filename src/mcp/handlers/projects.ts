// src/mcp/handlers/projects.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import {
  getProjects,
  validateProjectName,
} from "../../config/projectConfig.js";
import { openProject, closeProjectSession } from "../../projectSessions/projectSessionStore.js";

/**
 * Register project-related handlers with the MCP server
 */
export function registerProjectHandlers(server: McpServer): void {
  server.tool("list_projects", "List available projects", {}, async () => {
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
  });

  server.tool(
    "open_project_session",
    "Open a project session",
    {
      projectName: zod.string().describe("The name of the project to open"),
    },
    async ({ projectName }) => {
      try {
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

        const projectSessionId = openProject(projectName);
        if (!projectSessionId) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Could not open project: ${projectName}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: projectSessionId,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error opening project: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "close_project_session",
    "Close a project session and clean up resources",
    {
      projectSessionId: zod.string().describe("The project session id to close"),
    },
    async ({ projectSessionId }) => {
      const closed = closeProjectSession(projectSessionId);

      if (closed) {
        return {
          content: [
            {
              type: "text",
              text: `Session closed: ${projectSessionId}`,
            },
          ],
        };
      } else {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Invalid project session id: ${projectSessionId}`,
            },
          ],
        };
      }
    }
  );
}
