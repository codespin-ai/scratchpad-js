import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { 
  executeDockerCommand, 
  checkContainerRunning, 
  checkNetworkExists
} from "../../docker/execution.js";
import { _setHomeDir } from "../../logging/logger.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../utils/setup.js";

// Check if Docker is available on the system
function isDockerAvailable(): boolean {
  try {
    const dockerCheck = spawnSync("docker", ["--version"]);
    return !(dockerCheck.error || dockerCheck.status !== 0);
  } catch {
    return false;
  }
}

describe("Docker Execution", function() {
  this.timeout(30000); // Docker operations can be slow
  
  let testDir: string;
  let projectPath: string;
  let originalHomeDir: unknown;
  const projectName = "test-project";
  const containerName = `codebox-test-container-${Date.now()}`;
  const networkName = `codebox-test-network-${Date.now()}`;
  const dockerImage = "alpine:latest";

  before(function() {
    // Skip tests if Docker is not available
    if (!isDockerAvailable()) {
      this.skip();
      return;
    }

    // Pull Alpine image before running tests
    try {
      spawnSync("docker", ["pull", dockerImage]);
    } catch (error) {
      console.error(`Failed to pull image: ${error}`);
      this.skip();
      return;
    }
  });

  beforeEach(async function() {
    // Skip tests if Docker is not available
    if (!isDockerAvailable()) {
      this.skip();
      return;
    }

    // Set up test environment
    testDir = createTestEnvironment();
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);

    // Create test project directory
    projectPath = path.join(testDir, "test-project");
    fs.mkdirSync(projectPath, { recursive: true });
    fs.writeFileSync(path.join(projectPath, "test.txt"), "Hello from container!");

    // Create test network
    try {
      spawnSync("docker", ["network", "create", networkName]);
    } catch (error) {
      console.error(`Failed to create test network: ${error}`);
    }

    // Start a test container
    try {
      spawnSync("docker", [
        "run", 
        "-d", 
        "--name", containerName, 
        "--network", networkName,
        "-v", `${projectPath}:${projectPath}`,
        dockerImage, 
        "sleep", "3600"
      ]);
    } catch (error) {
      console.error(`Failed to start test container: ${error}`);
      this.skip();
      return;
    }

    // Setup test config
    createTestConfig(testDir, {
      projects: [
        {
          name: projectName,
          hostPath: projectPath,
          containerName: containerName
        },
        {
          name: `${projectName}-image`,
          hostPath: projectPath,
          dockerImage: dockerImage
        },
        {
          name: `${projectName}-image-network`,
          hostPath: projectPath,
          dockerImage: dockerImage,
          network: networkName
        }
      ]
    });
  });

  afterEach(async function() {
    // Restore original home directory
    if (originalHomeDir) {
      _setHomeDir(originalHomeDir as () => string);
    }

    // Clean up test container
    try {
      spawnSync("docker", ["rm", "-f", containerName]);
    } catch (error) {
      console.error(`Error removing container: ${error}`);
    }

    // Clean up test network
    try {
      spawnSync("docker", ["network", "rm", networkName]);
    } catch (error) {
      console.error(`Error removing network: ${error}`);
    }

    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("checkContainerRunning", () => {
    it("should return true for running containers", async function() {
      const result = await checkContainerRunning(containerName);
      expect(result).to.be.true;
    });

    it("should return false for non-existent containers", async function() {
      const result = await checkContainerRunning("non-existent-container");
      expect(result).to.be.false;
    });
  });

  describe("checkNetworkExists", () => {
    it("should return true for existing networks", async function() {
      const result = await checkNetworkExists(networkName);
      expect(result).to.be.true;
    });

    it("should return false for non-existent networks", async function() {
      const result = await checkNetworkExists("non-existent-network");
      expect(result).to.be.false;
    });
  });

  describe("executeDockerCommand", () => {
    it("should execute commands in an existing container", async function() {
      const result = await executeDockerCommand(projectName, "cat test.txt");
      expect(result.stdout).to.include("Hello from container!");
      expect(result.stderr).to.equal("");
    });

    it("should execute commands with a Docker image", async function() {
      const result = await executeDockerCommand(`${projectName}-image`, "cat test.txt");
      expect(result.stdout).to.include("Hello from container!");
      expect(result.stderr).to.equal("");
    });

    it("should execute commands with a Docker image and network", async function() {
      const result = await executeDockerCommand(`${projectName}-image-network`, "cat test.txt");
      expect(result.stdout).to.include("Hello from container!");
      expect(result.stderr).to.equal("");
    });

    it("should handle command errors", async function() {
      try {
        await executeDockerCommand(projectName, "cat /nonexistent/file");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).to.include("No such file or directory");
      }
    });

    it("should throw for non-existent projects", async function() {
      try {
        await executeDockerCommand("non-existent-project", "echo hello");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).to.include("Project not registered");
      }
    });
  });
});