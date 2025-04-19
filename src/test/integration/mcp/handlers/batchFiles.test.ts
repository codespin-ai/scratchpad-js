// Full file: src/test/integration/mcp/handlers/batchFiles.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBatchFileHandlers } from "../../../../mcp/handlers/batchFiles.js";
import { setupTestEnvironment, createTestConfig } from "../../setup.js";

// Mock request handler type
interface RequestHandler {
  (args: Record<string, any>): Promise<any>;
}

describe("Batch File Handlers", function () {
  let testDir: string;
  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let writeBatchFilesHandler: RequestHandler;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    testDir = env.testDir;
    configDir = env.configDir;
    projectDir = env.projectDir;
    cleanup = env.cleanup;

    // Register the project in the config
    createTestConfig(configDir, {
      projects: [
        {
          name: "test-project",
          hostPath: projectDir,
          dockerImage: "dummy-image",
        },
      ],
    });

    // Create a simple server to register handlers
    const server = {
      tool: (
        name: string,
        description: string,
        schema: object,
        handler: any
      ) => {
        if (name === "write_batch_files") {
          writeBatchFilesHandler = handler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerBatchFileHandlers(server);
  });

  afterEach(function () {
    // Clean up test environment
    cleanup();
  });

  describe("write_batch_files", function () {
    it("should write multiple files in a single operation", async function () {
      const response = await writeBatchFilesHandler({
        projectName: "test-project",
        files: [
          {
            filePath: "file1.txt",
            content: "Content for file 1",
            mode: "overwrite",
          },
          {
            filePath: "nested/file2.txt",
            content: "Content for file 2",
            mode: "overwrite",
          },
        ],
      });

      // Allow for both undefined and false as valid success indicators
      // This is more flexible and works with different handler implementations
      expect(response.isError || false).to.be.false;
      expect(response.content[0].text).to.include("Successfully wrote file");

      // Verify files were created
      const file1Path = path.join(projectDir, "file1.txt");
      const file2Path = path.join(projectDir, "nested/file2.txt");

      expect(fs.existsSync(file1Path)).to.be.true;
      expect(fs.existsSync(file2Path)).to.be.true;

      expect(fs.readFileSync(file1Path, "utf8")).to.equal("Content for file 1");
      expect(fs.readFileSync(file2Path, "utf8")).to.equal("Content for file 2");
    });

    it("should stop on first error if stopOnError is true", async function () {
      // First create a file we can append to
      const validFilePath = path.join(projectDir, "valid.txt");
      fs.writeFileSync(validFilePath, "Initial content\n");

      const response = await writeBatchFilesHandler({
        projectName: "test-project",
        files: [
          {
            filePath: "../outside.txt", // Invalid path
            content: "This should fail",
            mode: "overwrite",
          },
          {
            filePath: "valid.txt",
            content: "Appended content",
            mode: "append",
          },
        ],
        stopOnError: true,
      });

      // Verify the error response
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include("Failed");
      expect(response.content[0].text).to.include("Invalid file path");

      // Second operation should not have happened
      expect(fs.readFileSync(validFilePath, "utf8")).to.equal(
        "Initial content\n"
      );
    });

    it("should continue after errors if stopOnError is false", async function () {
      // First create a file we can append to
      const validFilePath = path.join(projectDir, "valid2.txt");
      fs.writeFileSync(validFilePath, "Initial content\n");

      const response = await writeBatchFilesHandler({
        projectName: "test-project",
        files: [
          {
            filePath: "../outside.txt", // Invalid path
            content: "This should fail",
            mode: "overwrite",
          },
          {
            filePath: "valid2.txt",
            content: "Appended content",
            mode: "append",
          },
        ],
        stopOnError: false,
      });

      // Response should indicate partial success
      expect(response.content[0].text).to.include("Failed");
      expect(response.content[0].text).to.include("Success");

      // Second operation should have happened
      expect(fs.readFileSync(validFilePath, "utf8")).to.equal(
        "Initial content\nAppended content"
      );
    });

    it("should return error for invalid project", async function () {
      const response = await writeBatchFilesHandler({
        projectName: "non-existent-project",
        files: [
          {
            filePath: "file.txt",
            content: "This should fail",
            mode: "overwrite",
          },
        ],
      });

      // Verify the error response
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include(
        "Invalid or unregistered project"
      );
    });
  });
});
