// src/fs/pathValidation.ts
import * as path from "path";
import * as fs from "fs";

/**
 * Validate that a directory exists
 * @throws Error if directory doesn't exist or is not a directory
 */
export function validateDirectory(dirPath: string): void {
  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  // Check if it's a directory
  if (!fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }
}

/**
 * Validate that a file path is within a project directory
 */
export function validateFilePath(
  projectDir: string,
  filePath: string
): boolean {
  const resolvedProjectDir = path.resolve(projectDir);
  const fullPath = path.join(resolvedProjectDir, filePath);

  // Ensure the resulting path is still within the project directory
  return fullPath.startsWith(resolvedProjectDir);
}

/**
 * Ensure directories exist for a file path
 */
export function ensureDirectoryForFile(filePath: string): void {
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}