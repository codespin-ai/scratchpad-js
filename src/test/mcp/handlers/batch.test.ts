import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { registerBatchHandlers } from "../../../mcp/handlers/batch.js";
import { _setHomeDir } from "../../../logging/logger.js";
import { TestToolRegistration } from "../../utils/mcpTestUtil.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../../utils/setup.js";

// Check if Docker is available on the system
function isDockerAvailable(): boolean {
  try {
    const dockerCheck = spawnSync("docker", ["--version"]);
    return !(dockerCheck.error || dockerCheck.status !== 0);
  } catch {
    return false;
  }
}

describe("Batch MCP Handler", function() {
  this.timeout(30000); // Docker operations can be slow
  
  let testDir: string;
  let projectPath: string;
  let originalHomeDir: unknown;
  let toolRegistration: TestToolRegistration;
  const projectName = "test-project";
  const containerName = `codebox-test-container-${Date.now()}`;
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
    fs.writeFileSync(path.join(projectPath, "test.txt"), "Hello from Docker!");

    // Start a test container
    try {
      spawnSync("docker", [
        "run", 
        "-d", 
        "--name", containerName, 
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
        }
      ]
    });

    // Set up test tool registration
    toolRegistration = new TestToolRegistration();
    const server = toolRegistration.getServer();
    registerBatchHandlers(server as any);
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

    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("execute_batch_commands", () => {
    it("should execute multiple commands in sequence", async function() {
      // Call the execute_batch_commands tool
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectName,
        commands: [
          `cat ${path.join(projectPath, "test.txt")}`,
          "echo 'Second command'"
        ]
      }) as { content: { text: string }[] };

      // Verify both commands executed
      expect(response.content[0].text).to.include("Hello from Docker!");
      expect(response.content[0].text).to.include("Second command");
      expect(response.content[0].text).to.include("Success"); // Status
    });

    it("should stop on error when stopOnError is true", async function() {
      // Call the execute_batch_commands tool with a failing command
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectName,
        commands: [
          "echo 'First command'",
          "cat /nonexistent/file", // This should fail
          "echo 'Should not execute'"
        ],
        stopOnError: true
      }) as { isError: boolean; content: { text: string }[] };

      // Verify execution stopped after the failure
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include("First command");
      expect(response.content[0].text).to.include("No such file or directory");
      expect(response.content[0].text).to.not.include("Should not execute");
    });

    it("should continue on error when stopOnError is false", async function() {
      // Call the execute_batch_commands tool with a failing command
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectName,
        commands: [
          "echo 'First command'",
          "cat /nonexistent/file", // This should fail
          "echo 'Should still execute'"
        ],
        stopOnError: false
      }) as { isError: boolean; content: { text: string }[] };

      // Verify all commands executed despite error
      expect(response.content[0].text).to.include("First command");
      expect(response.content[0].text).to.include("No such file or directory");
      expect(response.content[0].text).to.include("Should still execute");
    });

    it("should execute commands with a Docker image", async function() {
      // Call the execute_batch_commands tool with image-based project
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectName: `${projectName}-image`,
        commands: [
          `cat ${path.join(projectPath, "test.txt")}`,
          "echo 'Using Docker image'"
        ]
      }) as { content: { text: string }[] };

      // Verify both commands executed
      expect(response.content[0].text).to.include("Hello from Docker!");
      expect(response.content[0].text).to.include("Using Docker image");
    });

    it("should return error for invalid project name", async function() {
      // Call with invalid project name
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectName: "invalid-project",
        commands: ["echo hello"]
      }) as { isError: boolean; content: { text: string }[] };

      // Verify error response
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include("Invalid or unregistered project");
    });
  });
});