import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { registerExecuteHandlers } from "../../../mcp/handlers/execute.js";
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

describe("Execute MCP Handler", function() {
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
    registerExecuteHandlers(server as any);
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

  describe("execute_command", () => {
    it("should execute a command in a container", async function() {
      // Call the execute_command tool
      const response = await toolRegistration.callTool("execute_command", {
        projectName,
        command: `cat ${path.join(projectPath, "test.txt")}`
      }) as { content: { text: string }[] };

      // Verify response
      expect(response.content[0].text).to.include("Hello from Docker!");
    });

    it("should execute a command with a Docker image", async function() {
      // Call the execute_command tool with image-based project
      const response = await toolRegistration.callTool("execute_command", {
        projectName: `${projectName}-image`,
        command: `cat ${path.join(projectPath, "test.txt")}`
      }) as { content: { text: string }[] };

      // Verify response
      expect(response.content[0].text).to.include("Hello from Docker!");
    });

    it("should handle command errors", async function() {
      // Call the execute_command tool with an invalid command
      const response = await toolRegistration.callTool("execute_command", {
        projectName,
        command: "cat /nonexistent/file"
      }) as { isError: boolean; content: { text: string }[] };

      // Verify error response
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include("No such file or directory");
    });

    it("should return error for invalid project name", async function() {
      // Call the execute_command tool with an invalid project
      const response = await toolRegistration.callTool("execute_command", {
        projectName: "invalid-project",
        command: "echo hello"
      }) as { isError: boolean; content: { text: string }[] };

      // Verify error response
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include("Invalid or unregistered project");
    });
  });
});