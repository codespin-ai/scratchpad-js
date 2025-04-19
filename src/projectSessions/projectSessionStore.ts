// src/sessions/sessionStore.ts
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { getProjectByName } from "../config/projectConfig.js";
import {
  copyDirectory,
  createTempDirectory,
  removeDirectory,
} from "../fs/dirUtils.js";

// Project Session information including working directory
interface SessionInfo {
  projectName: string;
  workingDir: string; // Either original hostPath or temp directory
  isTempDir: boolean; // Flag to determine if cleanup is needed when closing
}

// In-memory store of active sessions
const activeProjectSessions: Record<string, SessionInfo> = {};

/**
 * Open a project and return a projectSession ID
 * @param projectName The name of the project to open
 * @returns project session id or null if project doesn't exist
 */
export function openProject(projectName: string): string | null {
  const project = getProjectByName(projectName);
  if (!project) {
    return null;
  }

  // Generate a new projectSession ID
  const projectSessionId = uuidv4();

  let workingDir = project.hostPath;
  let isTempDir = false;

  // If copy is enabled, create a temporary directory and copy files
  if (project.copy) {
    try {
      const tempDir = createTempDirectory(`codebox-${projectName}-project session-`);
      copyDirectory(project.hostPath, tempDir);
      workingDir = tempDir;
      isTempDir = true;
    } catch (error) {
      console.error(
        `Failed to create temporary directory for project ${projectName}:`,
        error
      );
      return null;
    }
  }

  // Store the projectSession information
  activeProjectSessions[projectSessionId] = {
    projectName,
    workingDir,
    isTempDir,
  };

  return projectSessionId;
}

/**
 * Get the project name for a projectSession ID
 * @param projectSessionId The projectSession ID
 * @returns Project name or null if projectSession doesn't exist
 */
export function getProjectNameForProjectSession(projectSessionId: string): string | null {
  return activeProjectSessions[projectSessionId]?.projectName || null;
}

/**
 * Get the working directory for a projectSession
 * @param projectSessionId The projectSession ID
 * @returns Working directory path or null if projectSession doesn't exist
 */
export function getWorkingDirForProjectSession(projectSessionId: string): string | null {
  return activeProjectSessions[projectSessionId]?.workingDir || null;
}

/**
 * Check if a projectSession exists
 * @param projectSessionId The projectSession ID to check
 * @returns True if the projectSession exists
 */
export function projectSessionExists(projectSessionId: string): boolean {
  return projectSessionId in activeProjectSessions;
}

/**
 * Get full projectSession information
 * @param projectSessionId The projectSession ID
 * @returns Project Session information or null if not found
 */
export function getProjectSessionInfo(projectSessionId: string): SessionInfo | null {
  return activeProjectSessions[projectSessionId] || null;
}

/**
 * Close a projectSession and clean up resources
 * @param projectSessionId The projectSession ID to close
 * @returns True if projectSession was closed, false if it didn't exist
 */
export function closeProjectSession(projectSessionId: string): boolean {
  if (projectSessionId in activeProjectSessions) {
    const sessionInfo = activeProjectSessions[projectSessionId];

    // Clean up temporary directory if one was created
    if (sessionInfo.isTempDir && fs.existsSync(sessionInfo.workingDir)) {
      try {
        removeDirectory(sessionInfo.workingDir);
      } catch (error) {
        console.error(`Error cleaning up temporary directory: ${error}`);
      }
    }

    // Remove the projectSession
    delete activeProjectSessions[projectSessionId];
    return true;
  }
  return false;
}
