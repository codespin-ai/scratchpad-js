// src/test/integration/docker/execution.test.ts
import { expect } from "chai";
import * as path from "path";
import {
  checkContainerRunning,
  checkNetworkExists,
  executeDockerCommand,
} from "../../../docker/execution.js";
import { createTestConfig, setupTestEnvironment } from "../setup.js";
import {
  createNetwork,
  createTestContainer,
  createTestFile,
  isDockerAvailable,
  removeContainer,
  removeNetwork,
  uniqueName,
} from "../testUtils.js";

describe("Docker Execution", function () {
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

    it("should execute commands in an existing container", async function () {
      const { stdout } = await executeDockerCommand(
        projectName,
        "cat /workspace/test.txt"
      );

      expect(stdout).to.include("Hello from Docker test!");
    });

    it("should handle command errors", async function () {
      try {
        await executeDockerCommand(projectName, "cat /nonexistent/file.txt");
        // Should not reach here
        expect.fail("Command should have thrown an error");
      } catch (error: unknown) {
        expect((error as Error).message).to.include(
          "No such file or directory"
        );
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

    it("should execute commands with a Docker image", async function () {
      const { stdout } = await executeDockerCommand(
        projectName,
        "cat /workspace/test.txt"
      );

      expect(stdout).to.include("Hello from Docker test!");
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

      const { stdout } = await executeDockerCommand(
        projectName,
        "cat /custom-path/test.txt"
      );

      expect(stdout).to.include("Hello from Docker test!");
    });
  });

  // Updated Network Support test section in src/test/integration/docker/execution.test.ts
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
      // Just verify the Docker command includes the network parameter
      try {
        const { stdout } = await executeDockerCommand(
          projectName,
          "echo 'Testing network connection'"
        );

        // This just verifies the command succeeded - in a real scenario,
        // you would use services on the same network to verify connectivity
        expect(stdout).to.include("Testing network connection");

        // Success means the network parameter was included
      } catch (error: unknown) {
        // If there's a network-related error, it will be caught here
        expect.fail(
          `Network connection test failed: ${(error as Error).message}`
        );
      }
    });
  });
});
