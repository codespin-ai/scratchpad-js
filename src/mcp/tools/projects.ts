// src/mcp/tools/projects.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs";
import * as path from "path";
import * as zod from "zod";
import { getProjects, getDockerImage } from "../utils.js";

// Define the input schema type
const ProjectConfigInput = {
  projectDir: zod
    .string()
    .describe("The absolute path to the project directory"),
};

export function registerProjectTools(server: McpServer): void {
  server.tool("list_projects", "List available projects", {}, async () => {
    try {
      const projects = getProjects();

      if (projects.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No projects are registered. Use 'codebox project add <dirname>' to add projects.",
            },
          ],
        };
      }

      // Build detailed project information
      const projectDetails = projects.map((projectPath) => {
        const exists = fs.existsSync(projectPath);
        const dockerImage = exists ? getDockerImage(projectPath) : null;

        return {
          path: projectPath,
          status: exists ? "exists" : "missing",
          configured: dockerImage ? "yes" : "no",
          dockerImage: dockerImage || "not configured",
        };
      });

      // Format output
      const output = ["Registered Projects:", "-------------------"];
      projectDetails.forEach((project, index) => {
        output.push(`${index + 1}. ${project.path}`);
        output.push(`   Status: ${project.status}`);
        output.push(`   Configured: ${project.configured}`);
        if (project.configured === "yes") {
          output.push(`   Docker Image: ${project.dockerImage}`);
        }
        output.push("");
      });

      return {
        content: [
          {
            type: "text",
            text: output.join("\n"),
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
    "get_project_config",
    "Get configuration for a specific project",
    ProjectConfigInput,
    async ({ projectDir }) => {
      try {
        const projects = getProjects();
        const resolvedPath = path.resolve(projectDir);

        if (!projects.includes(resolvedPath)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Project is not registered. Use 'codebox project add' first.",
              },
            ],
          };
        }

        if (!fs.existsSync(resolvedPath)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Project directory does not exist.",
              },
            ],
          };
        }

        const dockerImage = getDockerImage(resolvedPath);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  path: resolvedPath,
                  exists: true,
                  configured: !!dockerImage,
                  dockerImage: dockerImage || null,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting project config: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }
  );
}
