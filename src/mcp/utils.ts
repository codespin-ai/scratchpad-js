// src/mcp/utils.ts
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const uid = process.getuid?.();
const gid = process.getgid?.();

export interface ExecuteResult {
  stdout: string;
  stderr: string;
}

export function getProjectsFile(): string {
  return path.join(os.homedir(), ".codespin", "projects.json");
}

export function getProjects(): string[] {
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

export function validateProject(projectDir: string): boolean {
  const resolvedPath = path.resolve(projectDir);
  const registeredProjects = getProjects();

  return (
    registeredProjects.includes(resolvedPath) &&
    fs.existsSync(resolvedPath) &&
    fs.statSync(resolvedPath).isDirectory()
  );
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

export function getDockerImage(projectDir: string): string | null {
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

export async function executeInContainer(
  projectDir: string,
  command: string,
  dockerImage: string
): Promise<ExecuteResult> {
  const dockerCommand = `docker run -i --rm \
  -v "${projectDir}:/home/project" \
  --workdir="/home/project" \
  --user=${uid}:${gid} \
  ${dockerImage} /bin/sh -c "${command}"`;

  try {
    return await execAsync(dockerCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
  } catch (error: any) {
    throw new Error(`Docker execution failed: ${error.message}`);
  }
}
