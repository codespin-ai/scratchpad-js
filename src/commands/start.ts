// src/commands/start.ts
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as zod from "zod";
import * as fs from "node:fs";
import * as os from "os";

// Convert exec to promise-based
const execAsync = promisify(exec);

interface CommandContext {
  workingDir: string;
}

function getProjectsFile(): string {
  return path.join(os.homedir(), ".codespin", "projects.json");
}

function getProjects(): string[] {
  const projectsFile = getProjectsFile();

  if (!fs.existsSync(projectsFile)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(projectsFile, "utf8"));
    return data.projects || [];
  } catch (error) {
    console.error("Failed to parse projects file");
    return [];
  }
}

function getDockerImage(projectDir: string): string | null {
  const configFile = path.join(projectDir, ".codespin", "codebox.json");

  if (!fs.existsSync(configFile)) {
    return null;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    return config.dockerImage || null;
  } catch (error) {
    console.error(`Failed to parse config file for ${projectDir}`);
    return null;
  }
}

export async function start(context: CommandContext): Promise<void> {
  console.error("Starting Codebox MCP server");

  // Create the MCP server
  const server = new McpServer(
    {
      name: "codebox",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
    }
  );

  // Main execution tool - requires project directory
  server.tool(
    "execute_command",
    "Execute a command in a Docker container for a specific project",
    {
      command: zod.string().describe("The command to execute in the container"),
      projectDir: zod
        .string()
        .describe("The absolute path to the project directory"),
    },
    async ({ command, projectDir }) => {
      // Validate project directory
      const resolvedPath = path.resolve(projectDir);

      // Get registered projects and check if project is registered
      const registeredProjects = getProjects();
      if (!registeredProjects.includes(resolvedPath)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Project directory is not registered. Use 'codebox project add' first.`,
            },
          ],
        };
      }

      // Check if directory exists
      if (!fs.existsSync(resolvedPath)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Project directory does not exist: ${resolvedPath}`,
            },
          ],
        };
      }

      // Get Docker image from project config
      const dockerImage = getDockerImage(resolvedPath);
      if (!dockerImage) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: No Docker image configured for this project. Run 'codebox init' in the project directory.`,
            },
          ],
        };
      }

      console.error(
        `Executing command in ${resolvedPath} using image ${dockerImage}: ${command}`
      );

      try {
        // Execute the Docker command
        const dockerCommand = `docker run -i --rm -v "${resolvedPath}:/home/project" --workdir="/home/project" ${dockerImage} /bin/sh -c "${command.replace(
          /"/g,
          '\\"'
        )}"`;
        console.error(`Docker command: ${dockerCommand}`);

        const { stdout, stderr } = await execAsync(dockerCommand, {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
        });

        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");

        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      } catch (error) {
        // Handle command execution errors
        console.error("Error executing command:", error);

        let errorMessage = "Unknown error occurred";
        if (error instanceof Error) {
          errorMessage = error.message;
          // @ts-ignore
          if (error.stderr) {
            // @ts-ignore
            errorMessage += `\nSTDERR: ${error.stderr}`;
          }
        }

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // Tool to list available project directories
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

      return {
        content: [
          {
            type: "text",
            text: `Available projects:\n\n${projects.join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error listing projects: ${error}` }],
      };
    }
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Codebox MCP server running. Waiting for commands...");
}
