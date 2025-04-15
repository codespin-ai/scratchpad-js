// src/test/mockUtils.ts
import * as path from "path";
import * as fs from "fs";

// Track which project directories are considered valid in tests
let validProjects: string[] = [];

/**
 * Register a project directory as valid for testing
 */
export function registerMockProject(projectDir: string): void {
  validProjects.push(path.resolve(projectDir));
}

/**
 * Clear all registered mock projects
 */
export function clearMockProjects(): void {
  validProjects = [];
}

/**
 * Mock implementation of validateProject that works with test projects
 */
export function mockValidateProject(projectDir: string): boolean {
  const resolvedPath = path.resolve(projectDir);

  // Ensure path exists and is a directory
  if (
    !fs.existsSync(resolvedPath) ||
    !fs.statSync(resolvedPath).isDirectory()
  ) {
    return false;
  }

  // Check if it's one of our registered test projects
  return validProjects.some((validPath) => {
    return (
      resolvedPath === validPath ||
      resolvedPath.startsWith(validPath + path.sep)
    );
  });
}

/**
 * Mock implementation of validateFilePath for tests
 */
export function mockValidateFilePath(
  projectDir: string,
  filePath: string
): boolean {
  const resolvedProjectDir = path.resolve(projectDir);
  const fullPath = path.join(resolvedProjectDir, filePath);

  // Ensure the resulting path is still within the project directory
  return fullPath.startsWith(resolvedProjectDir);
}

/**
 * A test tool registration class for simulating the MCP tooling environment
 */
export class TestToolRegistration {
  private tools = new Map<string, (params: unknown) => Promise<unknown>>();

  /**
   * Register a tool for testing
   */
  registerTool(
    name: string,
    handler: (params: unknown) => Promise<unknown>
  ): void {
    this.tools.set(name, handler);
  }

  /**
   * Call a registered tool with parameters
   */
  async callTool(name: string, params: unknown): Promise<unknown> {
    const handler = this.tools.get(name);
    if (!handler) {
      throw new Error(`Tool not found: ${name}`);
    }
    return await handler(params);
  }
}
