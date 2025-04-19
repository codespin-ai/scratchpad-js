// src/test/integration/mcp/handlers/execute.test.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect } from "chai";
import * as path from "path";
import { registerExecuteHandlers } from "../../../../mcp/handlers/execute.js";
import { createTestConfig, setupTestEnvironment } from "../../setup.js";
import {
  createTestContainer,
  createTestFile,
  isDockerAvailable,
  removeContainer,
  uniqueName
} from "../../testUtils.js";

// Mock request handler type
interface RequestHandler {
  (args: Record<string, any>): Promise<any>;
}

describe("Execute Handlers", function() {
  this.timeout(30000); // Docker operations can be slow
  
  let testDir: string;
  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let executeCommandHandler: RequestHandler;
  let dockerAvailable = false;
  let containerName: string;
  const projectName = "test-project";
  const dockerImage = "alpine:latest";

  before(async function() {
    // Check if Docker is available
    dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      console.warn("Docker not available. Docker tests will be skipped.");
    }
  });

  beforeEach(async function() {
    // Skip tests if Docker is not available
    if (!dockerAvailable) {
      this.skip();
      return;
    }

    // Setup test environment
    const env = setupTestEnvironment();
    testDir = env.testDir;
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
      tool: (name: string, description: string, schema: object, handler: any) => {
        if (name === "execute_command") {
          executeCommandHandler = handler;
        }
      }
    } as unknown as McpServer;

    // Register the handlers
    registerExecuteHandlers(server);
  });

  afterEach(async function() {
    if (dockerAvailable) {
      // Clean up Docker resources
      await removeContainer(containerName);
    }
    
    // Clean up test environment
    cleanup();
  });

  describe("execute_command (Container Mode)", function() {
    beforeEach(async function() {
      // Create a test container
      await createTestContainer(containerName, dockerImage, projectDir);
      
      // Register the container in the config
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: projectDir,
            containerName: containerName
          }
        ]
      });
    });

    it("should execute a command in the container", async function() {
      const response = await executeCommandHandler({
        projectName,
        command: "cat /workspace/test.txt"
      });

      // Verify the response
      expect(response.isError).to.be.undefined;
      expect(response.content[0].text).to.include("Hello from execute test!");
    });

    it("should handle command errors", async function() {
      const response = await executeCommandHandler({
        projectName,
        command: "cat /nonexistent/file.txt"
      });

      // Verify the error response
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include("No such file");
    });

    it("should return error for invalid project", async function() {
      const response = await executeCommandHandler({
        projectName: "non-existent-project",
        command: "echo 'This should fail'"
      });

      // Verify the error response
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include("Invalid or unregistered project");
    });
  });

  describe("execute_command (Image Mode)", function() {
    beforeEach(function() {
      // Register the image in the config
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: projectDir,
            dockerImage
          }
        ]
      });
    });

    it("should execute a command with the image", async function() {
      const response = await executeCommandHandler({
        projectName,
        command: "cat /workspace/test.txt"
      });

      // Verify the response
      expect(response.isError).to.be.undefined;
      expect(response.content[0].text).to.include("Hello from execute test!");
    });
  });
});