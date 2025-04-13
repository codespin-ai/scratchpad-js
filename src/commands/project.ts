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
