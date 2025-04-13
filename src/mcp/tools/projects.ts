// src/mcp/tools/projects.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs";
import * as path from "path";
import * as zod from "zod";
import { getProjects, getDockerImage, getSystemConfig } from "../utils.js";

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
      const systemConfig = getSystemConfig();

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
        
        // Check if this is using system fallback
        const configFile = path.join(projectPath, ".codespin", "codebox.json");
        const hasLocalConfig = exists && fs.existsSync(configFile);
        let hasLocalDockerImage = false;
        
        if (hasLocalConfig) {
          try {
            const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
            hasLocalDockerImage = !!config.dockerImage;
          } catch {}
        }
        
        const usesSystemConfig = dockerImage && !hasLocalDockerImage && !!systemConfig?.dockerImage;

        return {
          path: projectPath,
          status: exists ? "exists" : "missing",
          configured: dockerImage ? "yes" : "no",
          dockerImage: dockerImage || "not configured",
          usesSystemConfig,
        };
      });

      // Format output
      const output = ["Registered Projects:", "-------------------"];
      projectDetails.forEach((project, index) => {
        output.push(`${index + 1}. ${project.path}`);
        output.push(`   Status: ${project.status}`);
        output.push(`   Configured: ${project.configured}`);
        if (project.configured === "yes") {
          output.push(`   Docker Image: ${project.dockerImage}${project.usesSystemConfig ? " (from system config)" : ""}`);
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
        const systemConfig = getSystemConfig();

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
        
        // Check if this is using system fallback
        const configFile = path.join(resolvedPath, ".codespin", "codebox.json");
        const hasLocalConfig = fs.existsSync(configFile);
        let hasLocalDockerImage = false;
        
        if (hasLocalConfig) {
          try {
            const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
            hasLocalDockerImage = !!config.dockerImage;
          } catch {}
        }
        
        const usesSystemConfig = dockerImage && !hasLocalDockerImage && !!systemConfig?.dockerImage;

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
                  usesSystemConfig: usesSystemConfig,
                  systemConfigAvailable: !!systemConfig?.dockerImage,
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