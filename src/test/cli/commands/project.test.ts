import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  addProject,
  removeProject,
  listProjects,
} from "../../../cli/commands/project.js";
import * as projectConfig from "../../../config/projectConfig.js";
import { _setHomeDir } from "../../../logging/logger.js";
import {
  createTestEnvironment,
  cleanupTestEnvironment,
} from "../../utils/setup.js";

describe("Project Commands", () => {
  let testDir: string;
  let projectPath: string;
  let originalHomeDir: unknown;
  let originalConsoleLog: typeof console.log;
  let originalConsoleWarn: typeof console.warn;
  let logMessages: string[];
  let warnMessages: string[];

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);

    // Create test project
    projectPath = path.join(testDir, "test-project");
    fs.mkdirSync(projectPath, { recursive: true });

    // Mock console.log and console.warn
    logMessages = [];
    warnMessages = [];
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    console.log = (message: string) => {
      logMessages.push(message);
    };
    console.warn = (message: string) => {
      warnMessages.push(message);
    };
  });

  afterEach(() => {
    // Restore original function
    _setHomeDir(originalHomeDir as () => string);

    // Restore console.log and console.warn
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;

    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("addProject", () => {
    it("should add a project with Docker image", async () => {
      // Call addProject with image
      await addProject(
        {
          dirname: projectPath,
          image: "node:14",
        },
        { workingDir: testDir }
      );

      // Check if project was added to config
      const config = projectConfig.getConfig();
      expect(config.projects.length).to.equal(1);
      expect(config.projects[0].name).to.equal("test-project");
      expect(config.projects[0].dockerImage).to.equal("node:14");
      expect(config.projects[0].hostPath).to.equal(projectPath);
    });

    it("should add a project with container name", async () => {
      // Call addProject with container name
      await addProject(
        {
          dirname: projectPath,
          containerName: "test-container",
        },
        { workingDir: testDir }
      );

      // Check if project was added to config
      const config = projectConfig.getConfig();
      expect(config.projects.length).to.equal(1);
      expect(config.projects[0].name).to.equal("test-project");
      expect(config.projects[0].containerName).to.equal("test-container");
    });

    it("should add a project with network", async () => {
      // Call addProject with image and network
      await addProject(
        {
          dirname: projectPath,
          image: "node:14",
          network: "test-network",
        },
        { workingDir: testDir }
      );

      // Check if project was added to config with network
      const config = projectConfig.getConfig();
      expect(config.projects.length).to.equal(1);
      expect(config.projects[0].network).to.equal("test-network");
    });

    it("should update existing project", async () => {
      // Add initial project
      await addProject(
        {
          dirname: projectPath,
          image: "node:14",
        },
        { workingDir: testDir }
      );

      // Update project with different image
      await addProject(
        {
          dirname: projectPath,
          image: "python:3.9",
        },
        { workingDir: testDir }
      );

      // Check if project was updated
      const config = projectConfig.getConfig();
      expect(config.projects.length).to.equal(1);
      expect(config.projects[0].dockerImage).to.equal("python:3.9");
    });

    it("should throw if neither image nor container specified", async () => {
      try {
        await addProject(
          {
            dirname: projectPath,
          },
          { workingDir: testDir }
        );
        expect.fail("Should have thrown an error");
      } catch (error) {
        // Fix the expected error message to match the actual one
        expect((error as Error).message).to.include(
          "Either Docker image (--image) or container name (--container) is required"
        );
      }
    });

    it("should throw if directory doesn't exist", async () => {
      try {
        await addProject(
          {
            dirname: "/non/existent/path",
            image: "node:14",
          },
          { workingDir: testDir }
        );
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).to.include("Directory not found");
      }
    });
  });

  describe("removeProject", () => {
    beforeEach(async () => {
      // Add test projects
      await addProject(
        {
          dirname: projectPath,
          image: "node:14",
        },
        { workingDir: testDir }
      );

      // Create a second project
      const secondPath = path.join(testDir, "second-project");
      fs.mkdirSync(secondPath, { recursive: true });

      await addProject(
        {
          dirname: secondPath,
          image: "python:3.9",
        },
        { workingDir: testDir }
      );

      // Reset log messages after setup
      logMessages = [];
    });

    it("should remove project by name", async () => {
      // Remove project by name
      await removeProject(
        {
          target: "test-project",
        },
        { workingDir: testDir }
      );

      // Check if project was removed
      const config = projectConfig.getConfig();
      expect(config.projects.length).to.equal(1);
      expect(config.projects[0].name).to.equal("second-project");

      // Verify console output
      const foundMessage = logMessages.some(
        (msg) => msg === "Removed project: test-project"
      );
      expect(foundMessage).to.be.true;
    });

    it("should remove project by path", async () => {
      // Remove project by path
      await removeProject(
        {
          target: projectPath,
        },
        { workingDir: testDir }
      );

      // Check if project was removed
      const config = projectConfig.getConfig();
      expect(config.projects.length).to.equal(1);
      expect(config.projects[0].name).to.equal("second-project");

      // Verify console output
      const foundMessage = logMessages.some(
        (msg) => msg === "Removed project: test-project"
      );
      expect(foundMessage).to.be.true;
    });

    it("should show message if project not found", async () => {
      // Try to remove non-existent project
      await removeProject(
        {
          target: "non-existent",
        },
        { workingDir: testDir }
      );

      // Check if no projects were removed
      const config = projectConfig.getConfig();
      expect(config.projects.length).to.equal(2);

      // Verify console output
      const foundMessage = logMessages.some(
        (msg) => msg === "Project with name 'non-existent' not found"
      );
      expect(foundMessage).to.be.true;
    });
  });

  describe("listProjects", () => {
    it("should show message when no projects are registered", async () => {
      // Call listProjects with empty config
      await listProjects();

      // Verify console output - fix the test to properly check logged messages
      expect(logMessages.length).to.be.greaterThan(0);
      // Check if any of the logged messages contains the expected text
      const foundMessage = logMessages.some(
        (msg) =>
          typeof msg === "string" && msg.includes("No projects are registered")
      );
      expect(foundMessage).to.be.true;
    });

    it("should list all registered projects", async () => {
      // Add test projects
      await addProject(
        {
          dirname: projectPath,
          image: "node:14",
        },
        { workingDir: testDir }
      );

      // Reset console logs after setup
      logMessages = [];

      // Call listProjects
      await listProjects();

      // Verify console output contains project name - fix how we check the output
      const foundProjectName = logMessages.some(
        (msg) => typeof msg === "string" && msg.includes("test-project")
      );
      expect(foundProjectName).to.be.true;
    });
  });
});
