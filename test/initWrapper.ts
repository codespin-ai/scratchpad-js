import * as path from "path";
import * as fs from "fs";
import { getGitRoot } from "../src/utils/git.js";

interface InitOptions {
  force?: boolean;
  image: string;
  system?: boolean;
  debug?: boolean;
}

interface CommandContext {
  workingDir: string;
}

/**
 * For our non-git directory test - we need to override the git root function just for testing
 */
let mockGitRoot: string | undefined | null = null;
export function setMockGitRoot(value: string | undefined | null): void {
  mockGitRoot = value;
}

/**
 * This is a wrapper around the init function that allows testing with a custom home directory
 */
export async function initWithCustomHome(
  options: InitOptions,
  context: CommandContext,
  customHomeDir: string
): Promise<void> {
  const { workingDir } = context;
  const { force, image, system, debug } = options;

  if (!image) {
    throw new Error("Docker image is required. Use --image <image_name>");
  }

  if (system) {
    // Initialize system-level configuration using the custom home directory
    const configDir = path.join(customHomeDir, ".codespin");
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const configFile = path.join(configDir, "codebox.json");

    // Check if config file already exists and we're not forcing
    if (fs.existsSync(configFile) && !force) {
      throw new Error("System configuration already exists. Use --force to overwrite.");
    }

    // Read existing config to preserve projects array if it exists
    let existingData = { projects: [] };
    if (fs.existsSync(configFile)) {
      try {
        existingData = JSON.parse(fs.readFileSync(configFile, "utf8"));
      } catch (error) {
        console.log("Could not parse existing config file, creating new one.");
      }
    }

    // Create config file with updated dockerImage and debug flag if provided
    const config = {
      ...existingData,
      dockerImage: image,
      ...(debug !== undefined ? { debug } : {})
    };

    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf8");
    console.log(
      `Created system configuration at ${configFile} with Docker image: ${image}${debug ? ' and debug enabled' : ''}`
    );
  } else {
    // Project-level initialization
    // Verify we're in a git repository - use mock if set, otherwise call real function
    let gitRoot: string | undefined;
    if (mockGitRoot !== null) {
      gitRoot = mockGitRoot === undefined ? undefined : mockGitRoot;
    } else {
      gitRoot = await getGitRoot(workingDir);
    }
    
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

    const configFile = path.join(configDir, "codebox.json");

    // Check if config file already exists and we're not forcing
    if (fs.existsSync(configFile) && !force) {
      throw new Error("Configuration already exists. Use --force to overwrite.");
    }

    // Create config file
    const config = {
      dockerImage: image,
      ...(debug !== undefined ? { debug } : {})
    };

    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf8");
    console.log(
      `Created configuration at ${configFile} with Docker image: ${image}${debug ? ' and debug enabled' : ''}`
    );
  }
}