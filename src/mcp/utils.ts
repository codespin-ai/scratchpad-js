// src/mcp/utils.ts
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { ProjectConfig, SystemConfig } from "../types/config.js";

const execAsync = promisify(exec);

const uid = process.getuid?.();
const gid = process.getgid?.();

export interface ExecuteResult {
  stdout: string;
  stderr: string;
}

export function getProjectsFile(): string {
  return path.join(os.homedir(), ".codespin", "codebox.json");
}

export function getProjects(): ProjectConfig[] {
  const projectsFile = getProjectsFile();

  if (!fs.existsSync(projectsFile)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(projectsFile, "utf8"));
    return Array.isArray(data.projects) ? data.projects : [];
  } catch {
    console.error("Failed to parse projects file");
    return [];
  }
}

export function validateProject(projectDir: string): boolean {
  const resolvedPath = path.resolve(projectDir);
  // Ensure path exists and is a directory
  if (
    !fs.existsSync(resolvedPath) ||
    !fs.statSync(resolvedPath).isDirectory()
  ) {
    return false;
  }

  // Normalize paths by removing trailing slashes for consistent comparison
  const normalizedInputPath = resolvedPath.replace(/\/+$/, "");
  const registeredProjects = getProjects();

  // Check if the normalized input path is a registered project
  for (const project of registeredProjects) {
    const normalizedProjectPath = project.hostPath.replace(/\/+$/, "");

    // Check if the input path starts with a registered path followed by either
    // end of string or a path separator
    if (
      normalizedInputPath === normalizedProjectPath ||
      normalizedInputPath.startsWith(normalizedProjectPath + path.sep)
    ) {
      return true;
    }
  }

  return false;
}

export function validateFilePath(
  projectDir: string,
  filePath: string
): boolean {
  const resolvedProjectDir = path.resolve(projectDir);
  const fullPath = path.join(resolvedProjectDir, filePath);

  // Ensure the resulting path is still within the project directory
  return fullPath.startsWith(resolvedProjectDir);
}

export function getSystemConfig(): SystemConfig | null {
  const configFile = getProjectsFile();

  if (!fs.existsSync(configFile)) {
    return { projects: [] };
  }

  try {
    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    return {
      projects: Array.isArray(config.projects) ? config.projects : [],
      debug: config.debug,
    };
  } catch {
    console.error("Failed to parse system config file");
    return { projects: [] };
  }
}

export function getProjectConfig(projectDir: string): ProjectConfig | null {
  const resolvedPath = path.resolve(projectDir);
  const projects = getProjects();

  // Find the project configuration
  const project = projects.find((p) => {
    const normalizedProjectPath = p.hostPath.replace(/\/+$/, "");
    const normalizedInputPath = resolvedPath.replace(/\/+$/, "");

    return (
      normalizedInputPath === normalizedProjectPath ||
      normalizedInputPath.startsWith(normalizedProjectPath + path.sep)
    );
  });

  return project || null;
}

export function getDockerImage(projectDir: string): string | null {
  const project = getProjectConfig(projectDir);
  return project ? project.dockerImage || null : null;
}

export async function executeInContainer(
  projectDir: string,
  command: string,
  dockerImage?: string
): Promise<ExecuteResult> {
  const project = getProjectConfig(projectDir);
  if (!project) {
    throw new Error(`Project not registered: ${projectDir}`);
  }

  try {
    // Check if project uses a container name
    if (project.containerName) {
      // Check if container is running
      const { stdout: containerCheck } = await execAsync(
        `docker ps -q -f "name=^${project.containerName}$"`
      );

      if (!containerCheck.trim()) {
        throw new Error(
          `Container '${project.containerName}' not found or not running`
        );
      }

      // Execute command in the running container with the user's UID/GID
      const dockerCommand = `docker exec -i --user=${uid}:${gid} --workdir="${projectDir}" ${project.containerName} /bin/sh -c "${command}"`;
      return await execAsync(dockerCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
    } else if (dockerImage || project.dockerImage) {
      // Use regular Docker container with image
      const imageToUse = dockerImage || project.dockerImage;
      const containerPath = project.containerPath || "/app";

      if (!imageToUse) {
        throw new Error("No Docker image configured for this project");
      }

      const dockerCommand = `docker run -i --rm \
      -v "${project.hostPath}:${containerPath}" \
      --workdir="${containerPath}" \
      --user=${uid}:${gid} \
      ${imageToUse} /bin/sh -c "${command}"`;

      return await execAsync(dockerCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
    } else {
      throw new Error(
        "No Docker image or container configured for this project"
      );
    }
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout || "";
    const stderr = (error as { stderr?: string }).stderr || "";
    const combinedOutput = `${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`;

    throw new Error(
      `Docker execution failed:\n${
        (error as Error).message ? (error as Error).message + "\n" : ""
      }${combinedOutput}`
    );
  }
}
