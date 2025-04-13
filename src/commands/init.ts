// src/commands/init.ts
import * as fs from "fs";
import * as path from "path";
import { getGitRoot } from "../utils/git.js";

interface InitOptions {
  force?: boolean;
  image: string;
}

interface CommandContext {
  workingDir: string;
}

export async function init(
  options: InitOptions,
  context: CommandContext
): Promise<void> {
  const { workingDir } = context;
  const { force, image } = options;

  if (!image) {
    throw new Error("Docker image is required. Use --image <image_name>");
  }

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
    throw new Error("Configuration already exists. Use --force to overwrite.");
  }

  // Create config file
  const config = {
    dockerImage: image,
  };

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf8");
  console.log(
    `Created configuration at ${configFile} with Docker image: ${image}`
  );
}
