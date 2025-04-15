// src/mcp/tools/projects.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs";
import * as path from "path";
import * as zod from "zod";
import { getProjects, getSystemConfig } from "../utils.js";

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
              text: "No projects are registered. Use 'codebox project add <dirname> --image <image_name>' to add projects.",
            },
          ],
        };
      }

      // Build detailed project information
      const projectDetails = projects.map((project) => {
        const exists = fs.existsSync(project.path);
        
        return {
          path: project.path,
          status: exists ? "exists" : "missing",
          dockerImage: project.dockerImage,
        };
      });

      // Format output
      const output = ["Registered Projects:", "-------------------"];
      projectDetails.forEach((project, index) => {
        output.push(`${index + 1}. ${project.path}`);
        output.push(`   Status: ${project.status}`);
        output.push(`   Docker Image: ${project.dockerImage}`);
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
        
        // Find matching project configuration
        const project = projects.find(p => {
          const normalizedProjectPath = p.path.replace(/\/+$/, "");
          const normalizedInputPath = resolvedPath.replace(/\/+$/, "");
          
          return (
            normalizedInputPath === normalizedProjectPath ||
            normalizedInputPath.startsWith(normalizedProjectPath + path.sep)
          );
        });

        if (!project) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Project is not registered. Use 'codebox project add <dirname> --image <image_name>' first.",
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

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  path: resolvedPath,
                  exists: true,
                  dockerImage: project.dockerImage,
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