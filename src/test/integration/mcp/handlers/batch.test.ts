// src/test/integration/mcp/handlers/batch.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBatchHandlers } from "../../../../mcp/handlers/batch.js";
import { registerProjectHandlers } from "../../../../mcp/handlers/projects.js";
import { setupTestEnvironment, createTestConfig } from "../../setup.js";
import {
  isDockerAvailable,
  createTestContainer,
  removeContainer,
  uniqueName,
  createTestFile,
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

describe("Batch Command Handlers with Sessions", function () {
  this.timeout(30000); // Docker operations can be slow

  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let executeBatchCommandsHandler: RequestHandler;
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
    createTestFile(path.join(projectDir, "test.txt"), "Hello from batch test!");

    // Create a simple server to register handlers
    const server = {
      tool: (
        name: string,
        description: string,
        schema: object,
        handler: unknown
      ) => {
        if (name === "execute_batch_commands") {
          executeBatchCommandsHandler = handler as RequestHandler;
        } else if (name === "open_project_session") {
          openProjectSessionHandler = handler as RequestHandler;
        } else if (name === "close_project_session") {
          closeProjectSessionHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerBatchHandlers(server);
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

  describe("execute_batch_commands with sessions", function () {
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

    it("should execute a batch of commands in sequence using a project session", async function () {
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName,
      });

      const projectSessionId = openResponse.content[0].text;

      // Execute batch commands using the project session
      const response = await executeBatchCommandsHandler({
        projectSessionId,
        commands: [
          "echo 'First command' > /workspace/output.txt",
          "echo 'Second command' >> /workspace/output.txt",
          "cat /workspace/output.txt",
        ],
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("First command");
      expect(response.content[0].text).to.include("Second command");

      // Verify the file was created
      const outputPath = path.join(projectDir, "output.txt");
      expect(fs.existsSync(outputPath)).to.equal(true);
      const content = fs.readFileSync(outputPath, "utf8");
      expect(content).to.include("First command");
      expect(content).to.include("Second command");

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should stop execution on error if stopOnError is true", async function () {
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName,
      });

      const projectSessionId = openResponse.content[0].text;

      // Execute batch commands with an error in the middle
      const response = await executeBatchCommandsHandler({
        projectSessionId,
        commands: [
          "echo 'First command' > /workspace/output2.txt",
          "cat /nonexistent/file.txt",
          "echo 'Third command' >> /workspace/output2.txt",
        ],
        stopOnError: true,
      });

      // Response should include error information
      expect(response.content[0].text).to.include("Failed");
      expect(response.content[0].text).to.include("No such file");
      expect(response.content[0].text).not.to.include("Third command");

      // Verify file contents
      const outputPath = path.join(projectDir, "output2.txt");
      expect(fs.existsSync(outputPath)).to.equal(true);
      const content = fs.readFileSync(outputPath, "utf8");
      expect(content).to.include("First command");
      expect(content).not.to.include("Third command");

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should continue execution on error if stopOnError is false", async function () {
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName,
      });

      const projectSessionId = openResponse.content[0].text;

      // Execute batch commands with an error in the middle but continue
      const response = await executeBatchCommandsHandler({
        projectSessionId,
        commands: [
          "echo 'First command' > /workspace/output3.txt",
          "cat /nonexistent/file.txt",
          "echo 'Third command' >> /workspace/output3.txt",
        ],
        stopOnError: false,
      });

      // Response should include all commands
      expect(response.content[0].text).to.include("First command");
      expect(response.content[0].text).to.include("No such file");
      expect(response.content[0].text).to.include("Third command");

      // Verify file contents - should include both first and third command
      const outputPath = path.join(projectDir, "output3.txt");
      expect(fs.existsSync(outputPath)).to.equal(true);
      const content = fs.readFileSync(outputPath, "utf8");
      expect(content).to.include("First command");
      expect(content).to.include("Third command");

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should return error for invalid sessions", async function () {
      // Execute batch commands with invalid project session id
      const response = await executeBatchCommandsHandler({
        projectSessionId: "invalid-project session id",
        commands: ["echo 'This should fail'"],
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or expired project session id"
      );
    });
  });

  describe("execute_batch_commands with Copy Mode", function () {
    beforeEach(function () {
      // Register a project with copy mode enabled
      createTestConfig(configDir, {
        projects: [
          {
            name: "copy-project",
            hostPath: projectDir,
            dockerImage: dockerImage,
            copy: true,
          },
        ],
      });

      // Create a file we'll try to modify
      const outputFile = path.join(projectDir, "copy-output.txt");
      fs.writeFileSync(outputFile, "Original content");
    });

    it("should execute batch commands with copy mode without modifying original files", async function () {
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName: "copy-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // Execute batch commands to modify the file
      const response = await executeBatchCommandsHandler({
        projectSessionId,
        commands: [
          "echo 'Modified in batch' > /workspace/copy-output.txt",
          "echo 'Added new line' >> /workspace/copy-output.txt",
          "cat /workspace/copy-output.txt",
        ],
      });

      // Verify the command output shows the modified content
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Modified in batch");
      expect(response.content[0].text).to.include("Added new line");

      // But the original file should remain unchanged
      const originalContent = fs.readFileSync(
        path.join(projectDir, "copy-output.txt"),
        "utf8"
      );
      expect(originalContent).to.equal("Original content");

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should maintain changes across multiple batch command calls in the same project session", async function () {
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName: "copy-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // First batch - create a file
      await executeBatchCommandsHandler({
        projectSessionId,
        commands: ["echo 'First batch' > /workspace/multi-batch.txt"],
      });

      // Second batch - append to the file
      await executeBatchCommandsHandler({
        projectSessionId,
        commands: ["echo 'Second batch' >> /workspace/multi-batch.txt"],
      });

      // Third batch - read the file
      const response = await executeBatchCommandsHandler({
        projectSessionId,
        commands: ["cat /workspace/multi-batch.txt"],
      });

      // Verify the file contains content from both batches
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("First batch");
      expect(response.content[0].text).to.include("Second batch");

      // The file should not exist in the original project directory
      expect(fs.existsSync(path.join(projectDir, "multi-batch.txt"))).to.equal(
        false
      );

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });
  });
});
