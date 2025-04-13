#!/bin/bash

# Create directory structure
mkdir -p src/commands
mkdir -p src/utils

# Create src/index.ts
cat > src/index.ts << 'EOF'
#!/usr/bin/env node

import yargs from "yargs";
import { init } from "./commands/init.js";
import { start } from "./commands/start.js";
import { addProject, removeProject } from "./commands/project.js";
import { setInvokeMode } from "./utils/invokeMode.js";
import process from "node:process";

// Export utility functions
export * as fs from "./utils/fs.js";
export * as git from "./utils/git.js";
export * as process from "./utils/process.js";

setInvokeMode("cli");

export async function main() {
  yargs(process.argv.slice(2))
    .command(
      "init",
      "Initialize a scratchpad configuration for a git repository",
      (yargs) =>
        yargs.option("force", {
          type: "boolean",
          demandOption: false,
          describe: "Force overwrite the existing scratchpad.json config file",
        }),
      async (argv) => {
        await init(argv, { workingDir: process.cwd() });
        writeToConsole("Scratchpad initialization completed.");
      }
    )
    .command(
      "start",
      "Start the MCP server for executing commands in containers",
      (yargs) => yargs,
      async () => {
        await start({ workingDir: process.cwd() });
      }
    )
    .command(
      "project add <dirname>",
      "Add a project directory to the registry",
      (yargs) =>
        yargs.positional("dirname", {
          describe: "Path to the project directory",
          demandOption: true,
          type: "string",
        }),
      async (argv) => {
        await addProject(argv as any, { workingDir: process.cwd() });
        writeToConsole(`Project ${argv.dirname} successfully added.`);
      }
    )
    .command(
      "project remove <dirname>",
      "Remove a project directory from the registry",
      (yargs) =>
        yargs.positional("dirname", {
          describe: "Path to the project directory to remove",
          demandOption: true,
          type: "string",
        }),
      async (argv) => {
        await removeProject(argv as any, { workingDir: process.cwd() });
        writeToConsole(`Project ${argv.dirname} successfully removed.`);
      }
    )
    .command("version", "Display the current version", {}, async () => {
      writeToConsole("Scratchpad v1.0.0");
    })
    .demandCommand(1, "You need to specify a command")
    .showHelpOnFail(true)
    .help("help")
    .alias("h", "help").argv;
}

function writeToConsole(text?: string) {
  console.log(text ?? "");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
EOF

# Create src/commands/init.ts
cat > src/commands/init.ts << 'EOF'
import * as fs from "fs";
import * as path from "path";
import { getGitRoot } from "../utils/git.js";
import prompts from "prompts";

interface InitOptions {
  force?: boolean;
}

interface CommandContext {
  workingDir: string;
}

export async function init(
  options: InitOptions,
  context: CommandContext
): Promise<void> {
  const { workingDir } = context;
  const { force } = options;

  // Verify we're in a git repository
  const gitRoot = await getGitRoot(workingDir);
  if (!gitRoot) {
    throw new Error(
      "Not in a git repository. Please initialize a git repository first."
    );
  }

  // Create .codespin directory if it doesn't exist
  const configDir = path.join(gitRoot, ".codespin");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configFile = path.join(configDir, "scratchpad.json");

  // Check if config file already exists and we're not forcing
  if (fs.existsSync(configFile) && !force) {
    throw new Error(
      "Configuration already exists. Use --force to overwrite."
    );
  }

  // Prompt for Docker image
  const response = await prompts({
    type: "text",
    name: "dockerImage",
    message: "Enter the Docker image to use for this project:",
    validate: (value) => (value ? true : "Docker image is required")
  });

  if (!response.dockerImage) {
    throw new Error("Docker image is required. Initialization aborted.");
  }

  // Create config file
  const config = {
    dockerImage: response.dockerImage
  };

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf8");
  console.log(`Created configuration at ${configFile}`);
}
EOF

# Create src/commands/project.ts
cat > src/commands/project.ts << 'EOF'
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface ProjectOptions {
  dirname: string;
}

interface CommandContext {
  workingDir: string;
}

function getProjectsFile(): string {
  const configDir = path.join(os.homedir(), ".codespin");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  return path.join(configDir, "projects.json");
}

function getProjects(): { projects: string[] } {
  const projectsFile = getProjectsFile();
  
  if (!fs.existsSync(projectsFile)) {
    return { projects: [] };
  }
  
  try {
    return JSON.parse(fs.readFileSync(projectsFile, "utf8"));
  } catch (error) {
    console.error("Failed to parse projects file, creating new one");
    return { projects: [] };
  }
}

function saveProjects(projectsData: { projects: string[] }): void {
  const projectsFile = getProjectsFile();
  fs.writeFileSync(projectsFile, JSON.stringify(projectsData, null, 2), "utf8");
}

export async function addProject(
  options: ProjectOptions, 
  context: CommandContext
): Promise<void> {
  const { dirname } = options;
  
  // Resolve to absolute path
  const projectPath = path.resolve(context.workingDir, dirname);
  
  // Check if directory exists
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Directory not found: ${projectPath}`);
  }
  
  if (!fs.statSync(projectPath).isDirectory()) {
    throw new Error(`Path is not a directory: ${projectPath}`);
  }
  
  // Get existing projects
  const projectsData = getProjects();
  
  // Add project if not already in list
  if (!projectsData.projects.includes(projectPath)) {
    projectsData.projects.push(projectPath);
    saveProjects(projectsData);
    console.log(`Added project: ${projectPath}`);
  } else {
    console.log(`Project already in list: ${projectPath}`);
  }
}

export async function removeProject(
  options: ProjectOptions,
  context: CommandContext
): Promise<void> {
  const { dirname } = options;
  
  // Resolve to absolute path
  const projectPath = path.resolve(context.workingDir, dirname);
  
  // Get existing projects
  const projectsData = getProjects();
  
  // Remove project if found
  const index = projectsData.projects.indexOf(projectPath);
  if (index !== -1) {
    projectsData.projects.splice(index, 1);
    saveProjects(projectsData);
    console.log(`Removed project: ${projectPath}`);
  } else {
    throw new Error(`Project not found in list: ${projectPath}`);
  }
}
EOF

# Create src/commands/start.ts
cat > src/commands/start.ts << 'EOF'
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
  const configFile = path.join(projectDir, ".codespin", "scratchpad.json");
  
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
  console.error("Starting Scratchpad MCP server");

  // Create the MCP server
  const server = new McpServer(
    {
      name: "scratchpad",
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
              text: `Error: No Docker image configured for this project. Run 'scratchpad init' in the project directory.`,
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
                text: "No projects are registered. Use 'scratchpad project add <dirname>' to add projects.",
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
    }
  );

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Scratchpad MCP server running. Waiting for commands...");
}
EOF

# Create src/utils/git.ts
cat > src/utils/git.ts << 'EOF'
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let gitRoot: string | undefined;
let notUnderGit = false;

export async function getGitRoot(
  workingDir: string
): Promise<string | undefined> {
  if (notUnderGit) {
    return undefined;
  }

  try {
    if (!gitRoot) {
      const result = await execAsync(
        "git rev-parse --show-toplevel",
        { cwd: workingDir }
      );

      // trim is used to remove the trailing newline character from the output
      gitRoot = result.stdout.trim();
    }
    return gitRoot;
  } catch (error: any) {
    notUnderGit = true;
    return undefined;
  }
}
EOF

# Create src/utils/invokeMode.ts
cat > src/utils/invokeMode.ts << 'EOF'
type InvokeMode = "cli" | "api" | "test";

let currentInvokeMode: InvokeMode = "cli";

export function setInvokeMode(mode: InvokeMode): void {
  currentInvokeMode = mode;
}

export function getInvokeMode(): InvokeMode {
  return currentInvokeMode;
}
EOF

echo "All TypeScript files have been created successfully."