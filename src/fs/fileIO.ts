// src/fs/fileIO.ts
import * as fs from "fs";
import * as path from "path";
import { validateFilePath, ensureDirectoryForFile } from "./pathValidation.js";

/**
 * Write content to a file in a project directory
 * @throws Error if the file path is outside the project directory
 */
export function writeProjectFile(
  projectDir: string,
  filePath: string,
  content: string,
  mode: "overwrite" | "append" = "overwrite"
): void {
  // Validate the file path
  if (!validateFilePath(projectDir, filePath)) {
    throw new Error(`Invalid file path: ${filePath}`);
  }

  // Get the full path
  const fullPath = path.join(projectDir, filePath);
  
  // Make sure the directory exists
  ensureDirectoryForFile(fullPath);

  // Write the file
  fs.writeFileSync(fullPath, content, {
    flag: mode === "append" ? "a" : "w",
    encoding: "utf8",
  });
}

/**
 * Read content from a file in a project directory
 * @throws Error if the file path is outside the project directory
 */
export function readProjectFile(
  projectDir: string,
  filePath: string
): string {
  // Validate the file path
  if (!validateFilePath(projectDir, filePath)) {
    throw new Error(`Invalid file path: ${filePath}`);
  }

  // Get the full path
  const fullPath = path.join(projectDir, filePath);
  
  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read the file
  return fs.readFileSync(fullPath, "utf8");
}

/**
 * Check if a file exists in a project directory
 */
export function projectFileExists(
  projectDir: string,
  filePath: string
): boolean {
  // Validate the file path
  if (!validateFilePath(projectDir, filePath)) {
    return false;
  }

  // Get the full path
  const fullPath = path.join(projectDir, filePath);
  
  // Check if file exists
  return fs.existsSync(fullPath);
}