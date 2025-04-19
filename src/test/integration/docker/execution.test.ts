// src/test/integration/docker/execution.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  checkContainerRunning,
  checkNetworkExists,
  executeDockerCommand,
} from "../../../docker/execution.js";
import {
  closeProjectSession,
  getWorkingDirForProjectSession,
  openProject,
} from "../../../projectSessions/projectSessionStore.js";
import { createTestConfig, setupTestEnvironment } from "../setup.js";
import {
  createNetwork,
  createTestContainer,
  createTestFile,
  isDockerAvailable,
  removeContainer,
  removeNetwork,
  uniqueName
} from "../testUtils.js";

describe("Docker Execution with Sessions", function () {
  this.timeout(30000); // Docker operations can be slow

  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let dockerAvailable = false;
  let containerName: string;
  let networkName: string;
  const projectName = "test-project";
  const dockerImage = "alpine:latest";

  before(async function () {
    // Check if Docker is available
    dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      console.warn("Docker not available. Docker tests will be skipped.");
    }
  });

  beforeEach(async function () {
    // Skip tests if Docker is not available
    if (!dockerAvailable) {
      this.skip();
      return;
    }

    // Setup test environment
    const env = setupTestEnvironment();
    configDir = env.configDir;
    projectDir = env.projectDir;
    cleanup = env.cleanup;

    // Create unique names for container and network
    containerName = uniqueName("codebox-test-container");
    networkName = uniqueName("codebox-test-network");

    // Create a test file in the project directory
    createTestFile(
      path.join(projectDir, "test.txt"),
      "Hello from Docker test!"
    );

    // Create Docker network
    await createNetwork(networkName);
  });

  afterEach(async function () {
    if (dockerAvailable) {
      // Clean up Docker resources
      await removeContainer(containerName);
      await removeNetwork(networkName);
    }

    // Clean up test environment
    cleanup();
  });

  describe("Container Operations", function () {
    it("should check if a container is running", async function () {
      // Initially the container should not be running
      const initialCheck = await checkContainerRunning(containerName);
      expect(initialCheck).to.equal(false);

      // Start a container
      await createTestContainer(containerName, dockerImage, projectDir);

      // Now the container should be detected as running
      const runningCheck = await checkContainerRunning(containerName);
      expect(runningCheck).to.equal(true);
    });

    it("should check if a network exists", async function () {
      // The network should exist (created in beforeEach)
      const networkExists = await checkNetworkExists(networkName);
      expect(networkExists).to.equal(true);

      // Non-existent network should return false
      const nonExistentCheck = await checkNetworkExists("non-existent-network");
      expect(nonExistentCheck).to.equal(false);
    });
  });

  describe("Command Execution (Container Mode)", function () {
    beforeEach(async function () {
      // Create a test container
      await createTestContainer(containerName, dockerImage, projectDir);

      // Register the container in the config
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: projectDir,
            containerName: containerName,
          },
        ],
      });
    });

    it("should execute commands in an existing container using project session working directory", async function () {
      // Open a project session for testing
      const projectSessionId = openProject(projectName);
      expect(projectSessionId).to.not.equal(null);

      // Get the working directory from the project session
      const workingDir = getWorkingDirForProjectSession(projectSessionId as string);
      expect(workingDir).to.equal(projectDir);

      // Execute command using project name and project session working directory
      const { stdout } = await executeDockerCommand(
        projectName,
        "cat /workspace/test.txt",
        workingDir as string
      );

      expect(stdout).to.include("Hello from Docker test!");

      // Close the project session
      closeProjectSession(projectSessionId as string);
    });

    it("should handle command errors", async function () {
      // Open a project session for testing
      const projectSessionId = openProject(projectName);
      const workingDir = getWorkingDirForProjectSession(projectSessionId as string);

      try {
        await executeDockerCommand(
          projectName,
          "cat /nonexistent/file.txt",
          workingDir as string
        );
        // Should not reach here
        expect.fail("Command should have thrown an error");
      } catch (error: unknown) {
        expect((error as Error).message).to.include(
          "No such file or directory"
        );
      } finally {
        // Close the project session
        closeProjectSession(projectSessionId as string);
      }
    });
  });

  describe("Command Execution (Image Mode)", function () {
    beforeEach(function () {
      // Register the image in the config
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: projectDir,
            dockerImage: dockerImage,
          },
        ],
      });
    });

    it("should execute commands with a Docker image using project session working directory", async function () {
      // Open a project session for testing
      const projectSessionId = openProject(projectName);
      expect(projectSessionId).to.not.equal(null);

      // Get the working directory from the project session
      const workingDir = getWorkingDirForProjectSession(projectSessionId as string);
      expect(workingDir).to.equal(projectDir);

      // Execute command using project name and project session working directory
      const { stdout } = await executeDockerCommand(
        projectName,
        "cat /workspace/test.txt",
        workingDir as string
      );

      expect(stdout).to.include("Hello from Docker test!");

      // Close the project session
      closeProjectSession(projectSessionId as string);
    });

    it("should respect custom container path", async function () {
      // Update config with custom container path
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: projectDir,
            dockerImage: dockerImage,
            containerPath: "/custom-path",
          },
        ],
      });

      // Open a project session for testing
      const projectSessionId = openProject(projectName);
      const workingDir = getWorkingDirForProjectSession(projectSessionId as string);

      const { stdout } = await executeDockerCommand(
        projectName,
        "cat /custom-path/test.txt",
        workingDir as string
      );

      expect(stdout).to.include("Hello from Docker test!");

      // Close the project session
      closeProjectSession(projectSessionId as string);
    });
  });

  describe("Network Support", function () {
    beforeEach(function () {
      // Register the image with network in the config
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: projectDir,
            dockerImage: dockerImage,
            network: networkName,
          },
        ],
      });
    });

    it("should use the specified network", async function () {
      // Open a project session for testing
      const projectSessionId = openProject(projectName);
      const workingDir = getWorkingDirForProjectSession(projectSessionId as string);

      try {
        // Just verify the Docker command includes the network parameter
        const { stdout } = await executeDockerCommand(
          projectName,
          "echo 'Testing network connection'",
          workingDir as string
        );

        // This just verifies the command succeeded - in a real scenario,
        // you would use services on the same network to verify connectivity
        expect(stdout).to.include("Testing network connection");
      } catch (error: unknown) {
        // If there's a network-related error, it will be caught here
        expect.fail(
          `Network connection test failed: ${(error as Error).message}`
        );
      } finally {
        // Close the project session
        closeProjectSession(projectSessionId as string);
      }
    });
  });

  describe("Copy Mode", function () {
    beforeEach(function () {
      // Register the image in the config with copy mode enabled
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: projectDir,
            dockerImage: dockerImage,
            copy: true,
          },
        ],
      });
    });

    it("should use a temporary directory when copy mode is enabled", async function () {
      // Open a project session for testing with copy mode
      const projectSessionId = openProject(projectName);
      expect(projectSessionId).to.not.equal(null);

      // Get the working directory from the project session - should be a temp directory
      const workingDir = getWorkingDirForProjectSession(projectSessionId as string);
      expect(workingDir).to.not.equal(projectDir); // Should be a different directory

      // Verify the temp directory contains the test file
      expect(
        fs.existsSync(path.join(workingDir as string, "test.txt"))
      ).to.equal(true);

      // Execute a command that modifies a file in the temp directory
      await executeDockerCommand(
        projectName,
        "echo 'Modified content' > /workspace/test.txt",
        workingDir as string
      );

      // Verify the file in temp directory was modified
      expect(
        fs.readFileSync(path.join(workingDir as string, "test.txt"), "utf8")
      ).to.include("Modified content");

      // Verify the original file was not modified
      expect(
        fs.readFileSync(path.join(projectDir, "test.txt"), "utf8")
      ).to.equal("Hello from Docker test!");

      // Create a new file in the temp directory
      await executeDockerCommand(
        projectName,
        "echo 'New file' > /workspace/new-file.txt",
        workingDir as string
      );

      // Verify the new file exists in temp directory
      expect(
        fs.existsSync(path.join(workingDir as string, "new-file.txt"))
      ).to.equal(true);

      // Verify the new file doesn't exist in the original directory
      expect(fs.existsSync(path.join(projectDir, "new-file.txt"))).to.equal(
        false
      );

      // Close the project session - should clean up the temp directory
      closeProjectSession(projectSessionId as string);

      // Verify the temp directory has been cleaned up
      expect(fs.existsSync(workingDir as string)).to.equal(false);
    });

    it("should create separate temp directories for different sessions of the same project", async function () {
      // Open two sessions for the same project
      const projectSessionId1 = openProject(projectName);
      const projectSessionId2 = openProject(projectName);

      const workingDir1 = getWorkingDirForProjectSession(projectSessionId1 as string);
      const workingDir2 = getWorkingDirForProjectSession(projectSessionId2 as string);

      // Verify they are different directories
      expect(workingDir1).to.not.equal(workingDir2);

      // Modify file in first project session
      await executeDockerCommand(
        projectName,
        "echo 'Modified in project session 1' > /workspace/test.txt",
        workingDir1 as string
      );

      // Modify file in second project session
      await executeDockerCommand(
        projectName,
        "echo 'Modified in project session 2' > /workspace/test.txt",
        workingDir2 as string
      );

      // Verify changes are isolated to each project session
      expect(
        fs.readFileSync(path.join(workingDir1 as string, "test.txt"), "utf8")
      ).to.include("Modified in project session 1");
      expect(
        fs.readFileSync(path.join(workingDir2 as string, "test.txt"), "utf8")
      ).to.include("Modified in project session 2");

      // Original file should be unchanged
      expect(
        fs.readFileSync(path.join(projectDir, "test.txt"), "utf8")
      ).to.equal("Hello from Docker test!");

      // Clean up
      closeProjectSession(projectSessionId1 as string);
      closeProjectSession(projectSessionId2 as string);
    });
  });
});
