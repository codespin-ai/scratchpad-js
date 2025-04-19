// src/test/integration/mcp/handlers/execute.test.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { registerExecuteHandlers } from "../../../../mcp/handlers/execute.js";
import { createTestConfig, setupTestEnvironment } from "../../setup.js";
import {
  createTestContainer,
  createTestFile,
  isDockerAvailable,
  removeContainer,
  uniqueName,
} from "../../testUtils.js";

// Response type for MCP tools
interface McpResponse {
  isError?: boolean;
  content: {
    type: string;
    text: string;
  }[];
}

// Mock request handler type
type RequestHandler = (args: Record<string, unknown>) => Promise<McpResponse>;

describe("Execute Handlers", function () {
  this.timeout(30000); // Docker operations can be slow

  let _testDir: string;
  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let executeCommandHandler: RequestHandler;
  let dockerAvailable = false;
  let containerName: string;
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
    _testDir = env.testDir;
    configDir = env.configDir;
    projectDir = env.projectDir;
    cleanup = env.cleanup;

    // Create unique name for container
    containerName = uniqueName("codebox-test-container");

    // Create a test file in the project directory
    createTestFile(
      path.join(projectDir, "test.txt"),
      "Hello from execute test!"
    );

    // Create a simple server to register handlers
    const server = {
      tool: (
        name: string,
        description: string,
        schema: object,
        handler: unknown
      ) => {
        if (name === "execute_command") {
          executeCommandHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerExecuteHandlers(server);
  });

  afterEach(async function () {
    if (dockerAvailable) {
      // Clean up Docker resources
      await removeContainer(containerName);
    }

    // Clean up test environment
    cleanup();
  });

  describe("execute_command (Container Mode)", function () {
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

    it("should execute a command in the container", async function () {
      const response = await executeCommandHandler({
        projectName,
        command: "cat /workspace/test.txt",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Hello from execute test!");
    });

    it("should handle command errors", async function () {
      const response = await executeCommandHandler({
        projectName,
        command: "cat /nonexistent/file.txt",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include("No such file");
    });

    it("should return error for invalid project", async function () {
      const response = await executeCommandHandler({
        projectName: "non-existent-project",
        command: "echo 'This should fail'",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or unregistered project"
      );
    });

    it("should ignore copy mode for container execution", async function () {
      // Register the container with copy mode (which should be ignored)
      createTestConfig(configDir, {
        projects: [
          {
            name: "container-with-copy",
            hostPath: projectDir,
            containerName: containerName,
            copy: true, // This should be ignored for container execution
          },
        ],
      });

      // Create a file that we'll modify
      const filePath = path.join(projectDir, "container-modify.txt");
      fs.writeFileSync(filePath, "Original content");

      // Execute a command that modifies the file
      const response = await executeCommandHandler({
        projectName: "container-with-copy",
        command: "echo -n 'Modified by container' > /workspace/container-modify.txt",
      });

      // Verify the command execution succeeded
      expect(response.isError).to.equal(undefined);

      // Since copy mode is ignored for containers, the original file SHOULD be modified
      // Read the file content directly to avoid any special character handling issues
      const modifiedContent = fs.readFileSync(filePath, "utf8");
      expect(modifiedContent).to.equal("Modified by container");
    });
  });

  describe("execute_command (Image Mode)", function () {
    beforeEach(function () {
      // Register the image in the config
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: projectDir,
            dockerImage,
          },
        ],
      });
    });

    it("should execute a command with the image", async function () {
      const response = await executeCommandHandler({
        projectName,
        command: "cat /workspace/test.txt",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Hello from execute test!");
    });
  });

  describe("execute_command (Copy Mode)", function () {
    beforeEach(function () {
      // Register the image in the config with copy mode enabled
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: projectDir,
            dockerImage,
            copy: true,
          },
        ],
      });

      // Create a file we'll try to modify
      const filePath = path.join(projectDir, "for-copy-test.txt");
      fs.writeFileSync(filePath, "This file should not change");
    });

    it("should execute commands with file copying without modifying originals", async function () {
      const response = await executeCommandHandler({
        projectName,
        command: "echo 'Modified content' > /workspace/for-copy-test.txt && cat /workspace/for-copy-test.txt",
      });

      // Verify the command output shows the modified content
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Modified content");

      // But the original file should remain unchanged
      const filePath = path.join(projectDir, "for-copy-test.txt");
      expect(fs.readFileSync(filePath, "utf8")).to.equal("This file should not change");
    });
  });
});