// src/test/integration/sessions/sessionStore.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  closeProjectSession,
  getProjectNameForProjectSession,
  getWorkingDirForProjectSession,
  openProject,
  projectSessionExists,
} from "../../../projectSessions/projectSessionStore.js";
import { createTestConfig, setupTestEnvironment } from "../setup.js";
import { createTestFile } from "../testUtils.js";

describe("Session Store", function () {
  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    configDir = env.configDir;
    projectDir = env.projectDir;
    cleanup = env.cleanup;

    // Create a test file in the project directory
    createTestFile(path.join(projectDir, "test.txt"), "Original content");
  });

  afterEach(function () {
    cleanup();
  });

  describe("openProject", function () {
    it("should open a project session without copying files when copy=false", function () {
      // Register a project without copy mode
      createTestConfig(configDir, {
        projects: [
          {
            name: "test-project",
            hostPath: projectDir,
            dockerImage: "dummy-image",
            copy: false,
          },
        ],
      });

      // Open a project session
      const projectSessionId = openProject("test-project");
      expect(projectSessionId).to.be.a("string");
      expect(projectSessionId).to.not.equal(undefined);
      expect(projectSessionId).to.not.equal(null);

      // Verify project session is registered
      expect(projectSessionExists(projectSessionId as string)).to.equal(true);

      // Verify project name is correct
      expect(getProjectNameForProjectSession(projectSessionId as string)).to.equal(
        "test-project"
      );

      // Verify working directory is the original project directory
      expect(getWorkingDirForProjectSession(projectSessionId as string)).to.equal(projectDir);
    });

    it("should open a project session with copying files when copy=true", function () {
      // Register a project with copy mode
      createTestConfig(configDir, {
        projects: [
          {
            name: "test-project",
            hostPath: projectDir,
            dockerImage: "dummy-image",
            copy: true,
          },
        ],
      });

      // Open a project session
      const projectSessionId = openProject("test-project");
      expect(projectSessionId).to.be.a("string");
      expect(projectSessionId).to.not.equal(undefined);
      expect(projectSessionId).to.not.equal(null);

      // Verify project session is registered
      expect(projectSessionExists(projectSessionId as string)).to.equal(true);

      // Verify project name is correct
      expect(getProjectNameForProjectSession(projectSessionId as string)).to.equal(
        "test-project"
      );

      // Verify working directory is not the original project directory
      const workingDir = getWorkingDirForProjectSession(projectSessionId as string);
      expect(workingDir).to.not.equal(projectDir);

      // Verify the test file was copied to the temp directory
      expect(
        fs.existsSync(path.join(workingDir as string, "test.txt"))
      ).to.equal(true);
      expect(
        fs.readFileSync(path.join(workingDir as string, "test.txt"), "utf8")
      ).to.equal("Original content");
    });

    it("should return null for non-existent projects", function () {
      // Register a project
      createTestConfig(configDir, {
        projects: [
          {
            name: "test-project",
            hostPath: projectDir,
            dockerImage: "dummy-image",
          },
        ],
      });

      // Try to open non-existent project
      const projectSessionId = openProject("non-existent-project");
      expect(projectSessionId).to.equal(null);
    });
  });

  describe("closeSession", function () {
    it("should close a project session and return true", function () {
      // Register a project
      createTestConfig(configDir, {
        projects: [
          {
            name: "test-project",
            hostPath: projectDir,
            dockerImage: "dummy-image",
          },
        ],
      });

      // Open a project session
      const projectSessionId = openProject("test-project");
      expect(projectSessionId).to.be.a("string");

      // Close the project session
      const result = closeProjectSession(projectSessionId as string);
      expect(result).to.equal(true);

      // Verify project session no longer exists
      expect(projectSessionExists(projectSessionId as string)).to.equal(false);
    });

    it("should return false for non-existent sessions", function () {
      const result = closeProjectSession("non-existent-project session");
      expect(result).to.equal(false);
    });

    it("should clean up temporary directory when copy=true", function () {
      // Register a project with copy mode
      createTestConfig(configDir, {
        projects: [
          {
            name: "test-project",
            hostPath: projectDir,
            dockerImage: "dummy-image",
            copy: true,
          },
        ],
      });

      // Open a project session
      const projectSessionId = openProject("test-project");
      const workingDir = getWorkingDirForProjectSession(projectSessionId as string);

      // Verify temp directory exists
      expect(fs.existsSync(workingDir as string)).to.equal(true);

      // Close the project session
      closeProjectSession(projectSessionId as string);

      // Verify temp directory was removed
      expect(fs.existsSync(workingDir as string)).to.equal(false);
    });
  });

  describe("Session Isolation", function () {
    it("should maintain isolated file changes between sessions with copy=true", function () {
      // Register a project with copy mode
      createTestConfig(configDir, {
        projects: [
          {
            name: "test-project",
            hostPath: projectDir,
            dockerImage: "dummy-image",
            copy: true,
          },
        ],
      });

      // Open two sessions for the same project
      const sessionId1 = openProject("test-project");
      const sessionId2 = openProject("test-project");

      const workingDir1 = getWorkingDirForProjectSession(sessionId1 as string);
      const workingDir2 = getWorkingDirForProjectSession(sessionId2 as string);

      // Verify working directories are different
      expect(workingDir1).to.not.equal(workingDir2);

      // Make changes in first project session
      fs.writeFileSync(
        path.join(workingDir1 as string, "test.txt"),
        "Modified in project session 1"
      );

      // Make changes in second project session
      fs.writeFileSync(
        path.join(workingDir2 as string, "test.txt"),
        "Modified in project session 2"
      );

      // Verify changes are isolated
      expect(
        fs.readFileSync(path.join(workingDir1 as string, "test.txt"), "utf8")
      ).to.equal("Modified in project session 1");
      expect(
        fs.readFileSync(path.join(workingDir2 as string, "test.txt"), "utf8")
      ).to.equal("Modified in project session 2");

      // Verify original file is unchanged
      expect(
        fs.readFileSync(path.join(projectDir, "test.txt"), "utf8")
      ).to.equal("Original content");

      // Clean up
      closeProjectSession(sessionId1 as string);
      closeProjectSession(sessionId2 as string);
    });
  });
});
