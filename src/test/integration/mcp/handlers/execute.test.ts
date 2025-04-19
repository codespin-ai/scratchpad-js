// src/test/integration/mcp/handlers/execute.test.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { registerExecuteHandlers } from "../../../../mcp/handlers/execute.js";
import { registerProjectHandlers } from "../../../../mcp/handlers/projects.js";
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

describe("Execute Handlers with Sessions", function () {
  this.timeout(30000); // Docker operations can be slow

  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let executeCommandHandler: RequestHandler;
  let openProjectSessionHandler: RequestHandler;
  let closeProjectSessionHandler: RequestHandler;
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
        } else if (name === "open_project_session") {
          openProjectSessionHandler = handler as RequestHandler;
        } else if (name === "close_project_session") {
          closeProjectSessionHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerExecuteHandlers(server);
    registerProjectHandlers(server);
  });

  afterEach(async function () {
    if (dockerAvailable) {
      // Clean up Docker resources
      await removeContainer(containerName);
    }

    // Clean up test environment
    cleanup();
  });

  describe("execute_command with Container Mode", function () {
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

    it("should execute a command in the container using a project session", async function () {
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName,
      });

      const projectSessionId = openResponse.content[0].text;

      // Now execute command using the project session
      const response = await executeCommandHandler({
        projectSessionId,
        command: "cat /workspace/test.txt",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Hello from execute test!");

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should handle command errors", async function () {
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName,
      });

      const projectSessionId = openResponse.content[0].text;

      // Execute a command that will fail
      const response = await executeCommandHandler({
        projectSessionId,
        command: "cat /nonexistent/file.txt",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include("No such file");

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should return error for invalid sessions", async function () {
      // Execute command with invalid project session id
      const response = await executeCommandHandler({
        projectSessionId: "invalid-project session id",
        command: "echo 'This should fail'",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or expired project session id"
      );
    });
  });

  describe("execute_command with Image Mode", function () {
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

    it("should execute a command with the image using a project session", async function () {
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName,
      });

      const projectSessionId = openResponse.content[0].text;

      // Now execute command using the project session
      const response = await executeCommandHandler({
        projectSessionId,
        command: "cat /workspace/test.txt",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Hello from execute test!");

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });
  });

  describe("execute_command with Copy Mode", function () {
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
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName,
      });

      const projectSessionId = openResponse.content[0].text;

      // Execute a command that modifies a file
      const response = await executeCommandHandler({
        projectSessionId,
        command:
          "echo 'Modified content' > /workspace/for-copy-test.txt && cat /workspace/for-copy-test.txt",
      });

      // Verify the command output shows the modified content
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Modified content");

      // But the original file should remain unchanged
      const filePath = path.join(projectDir, "for-copy-test.txt");
      expect(fs.readFileSync(filePath, "utf8")).to.equal(
        "This file should not change"
      );

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should maintain changes across multiple commands in the same project session", async function () {
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName,
      });

      const projectSessionId = openResponse.content[0].text;

      // Execute a command that creates a file
      await executeCommandHandler({
        projectSessionId,
        command: "echo 'First command' > /workspace/project-session-test.txt",
      });

      // Execute a second command that reads the file created by the first command
      const response = await executeCommandHandler({
        projectSessionId,
        command: "cat /workspace/project-session-test.txt",
      });

      // Verify the second command can see the file created by the first
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("First command");

      // The file should not exist in the original project directory
      expect(fs.existsSync(path.join(projectDir, "project-session-test.txt"))).to.equal(
        false
      );

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });
  });
});
