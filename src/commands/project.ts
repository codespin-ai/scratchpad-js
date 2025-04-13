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

  return path.join(configDir, "codebox.json");
}

function getProjects(): { projects: string[] } {
  const projectsFile = getProjectsFile();

  if (!fs.existsSync(projectsFile)) {
    return { projects: [] };
  }

  try {
    const data = JSON.parse(fs.readFileSync(projectsFile, "utf8"));
    return { projects: data.projects || [] };
  } catch (error) {
    console.error("Failed to parse projects file, creating new one");
    return { projects: [] };
  }
}

function saveProjects(projectsData: { projects: string[], dockerImage?: string }): void {
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
    // Now just logging the message instead of throwing
    console.log(`Project not found in list: ${projectPath}`);
  }
}

export async function listProjects(context: CommandContext): Promise<void> {
  const projectsData = getProjects();

  if (projectsData.projects.length === 0) {
    console.log(
      "No projects are registered. Use 'codebox project add <dirname>' to add projects."
    );
    return;
  }

  console.log("Registered projects:");
  console.log("-------------------");

  // Get system config for fallback Docker image
  const projectsFile = getProjectsFile();
  let systemDockerImage = null;
  
  if (fs.existsSync(projectsFile)) {
    try {
      const systemConfig = JSON.parse(fs.readFileSync(projectsFile, "utf8"));
      systemDockerImage = systemConfig.dockerImage || null;
    } catch {}
  }

  projectsData.projects.forEach((projectPath, index) => {
    // Check if the project has a codebox configuration
    const configFile = path.join(projectPath, ".codespin", "codebox.json");
    const exists = fs.existsSync(projectPath);
    const hasConfig = exists && fs.existsSync(configFile);

    // Get the Docker image if configuration exists
    let dockerImage = "";
    let fromSystem = false;
    
    if (hasConfig) {
      try {
        const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
        dockerImage = config.dockerImage || "";
      } catch {
        dockerImage = "Invalid configuration";
      }
    }
    
    // If no project-specific image but there's a system image, use that
    if (!dockerImage && systemDockerImage) {
      dockerImage = systemDockerImage;
      fromSystem = true;
    }

    console.log(`${index + 1}. ${projectPath}`);
    console.log(`   Status: ${exists ? "exists" : "missing"}`);
    console.log(`   Configured: ${hasConfig || systemDockerImage ? "yes" : "no"}`);
    if (dockerImage) {
      console.log(`   Docker Image: ${dockerImage}${fromSystem ? " (from system config)" : ""}`);
    }
    console.log();
  });
}