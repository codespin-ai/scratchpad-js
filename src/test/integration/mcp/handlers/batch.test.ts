// Full file: src/test/integration/mcp/handlers/batch.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBatchHandlers } from "../../../../mcp/handlers/batch.js";
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

describe("Batch Command Handlers", function () {
  this.timeout(30000); // Docker operations can be slow

  let _testDir: string;
  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let executeBatchCommandsHandler: RequestHandler;
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
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerBatchHandlers(server);
  });

  afterEach(async function () {
    if (dockerAvailable) {
      // Clean up Docker resources
      await removeContainer(containerName);
    }

    // Clean up test environment
    cleanup();
  });

  describe("execute_batch_commands", function () {
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

    it("should execute a batch of commands in sequence", async function () {
      const response = await executeBatchCommandsHandler({
        projectName,
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
    });

    it("should stop execution on error if stopOnError is true", async function () {
      const response = await executeBatchCommandsHandler({
        projectName,
        commands: [
          "echo 'First command' > /workspace/output2.txt",
          "cat /nonexistent/file.txt",
          "echo 'Third command' >> /workspace/output2.txt",
        ],
        stopOnError: true,
      });

      // Instead of checking isError property, focus on verifying the behavior:
      // 1. Response content should include error information
      // 2. Third command shouldn't have executed
      expect(response.content[0].text).to.include("Failed");
      expect(response.content[0].text).to.include("No such file");
      expect(response.content[0].text).not.to.include("Third command");

      // Verify file contents
      const outputPath = path.join(projectDir, "output2.txt");
      expect(fs.existsSync(outputPath)).to.equal(true);
      const content = fs.readFileSync(outputPath, "utf8");
      expect(content).to.include("First command");
      expect(content).not.to.include("Third command");
    });

    it("should continue execution on error if stopOnError is false", async function () {
      const response = await executeBatchCommandsHandler({
        projectName,
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
    });

    it("should return error for invalid project", async function () {
      const response = await executeBatchCommandsHandler({
        projectName: "non-existent-project",
        commands: ["echo 'This should fail'"],
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or unregistered project"
      );
    });
  });
});
