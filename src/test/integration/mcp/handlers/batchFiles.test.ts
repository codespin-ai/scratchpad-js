// src/test/integration/mcp/handlers/batchFiles.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBatchFileHandlers } from "../../../../mcp/handlers/batchFiles.js";
import { registerProjectHandlers } from "../../../../mcp/handlers/projects.js";
import { setupTestEnvironment, createTestConfig } from "../../setup.js";

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

describe("Batch File Handlers with Sessions", function () {
  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let writeBatchFilesHandler: RequestHandler;
  let openProjectSessionHandler: RequestHandler;
  let closeProjectSessionHandler: RequestHandler;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
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
        {
          name: "copy-project",
          hostPath: projectDir,
          dockerImage: "dummy-image",
          copy: true,
        },
      ],
    });

    // Create a simple server to register handlers
    const server = {
      tool: (
        name: string,
        description: string,
        schema: object,
        handler: unknown
      ) => {
        if (name === "write_batch_files") {
          writeBatchFilesHandler = handler as RequestHandler;
        } else if (name === "open_project_session") {
          openProjectSessionHandler = handler as RequestHandler;
        } else if (name === "close_project_session") {
          closeProjectSessionHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerBatchFileHandlers(server);
    registerProjectHandlers(server);
  });

  afterEach(function () {
    cleanup();
  });

  describe("write_batch_files with sessions", function () {
    it("should write multiple files in a single operation using a project session", async function () {
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName: "test-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // Write multiple files using the project session
      const response = await writeBatchFilesHandler({
        projectSessionId,
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

      // Verify the response
      expect(response.isError || false).to.equal(false);
      expect(response.content[0].text).to.include("Success");

      // Verify files were created
      const file1Path = path.join(projectDir, "file1.txt");
      const file2Path = path.join(projectDir, "nested/file2.txt");

      expect(fs.existsSync(file1Path)).to.equal(true);
      expect(fs.existsSync(file2Path)).to.equal(true);

      expect(fs.readFileSync(file1Path, "utf8")).to.equal("Content for file 1");
      expect(fs.readFileSync(file2Path, "utf8")).to.equal("Content for file 2");

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should stop on first error if stopOnError is true", async function () {
      // First create a file we can append to
      const validFilePath = path.join(projectDir, "valid.txt");
      fs.writeFileSync(validFilePath, "Initial content\n");

      // Open a project session
      const openResponse = await openProjectSessionHandler({
        projectName: "test-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // Try to write files with one invalid path
      const response = await writeBatchFilesHandler({
        projectSessionId,
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
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include("Invalid file path");

      // Second operation should not have happened
      expect(fs.readFileSync(validFilePath, "utf8")).to.equal(
        "Initial content\n"
      );

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should continue after errors if stopOnError is false", async function () {
      // First create a file we can append to
      const validFilePath = path.join(projectDir, "valid2.txt");
      fs.writeFileSync(validFilePath, "Initial content\n");

      // Open a project session
      const openResponse = await openProjectSessionHandler({
        projectName: "test-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // Try to write files with one invalid path but continue
      const response = await writeBatchFilesHandler({
        projectSessionId,
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

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should return error for invalid sessions", async function () {
      const response = await writeBatchFilesHandler({
        projectSessionId: "invalid-project session id",
        files: [
          {
            filePath: "file.txt",
            content: "This should fail",
            mode: "overwrite",
          },
        ],
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or expired project session id"
      );
    });
  });

  describe("write_batch_files with Copy Mode", function () {
    it("should write multiple files to a copy without modifying original files", async function () {
      // Open a project session with copy=true
      const openResponse = await openProjectSessionHandler({
        projectName: "copy-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // Write multiple files using the project session
      const response = await writeBatchFilesHandler({
        projectSessionId,
        files: [
          {
            filePath: "batch-copy1.txt",
            content: "Content for file 1",
            mode: "overwrite",
          },
          {
            filePath: "batch-copy2.txt",
            content: "Content for file 2",
            mode: "overwrite",
          },
        ],
      });

      // Verify the response
      expect(response.isError || false).to.equal(false);
      expect(response.content[0].text).to.include("Success");

      // Verify files were NOT created in the original project directory
      const file1Path = path.join(projectDir, "batch-copy1.txt");
      const file2Path = path.join(projectDir, "batch-copy2.txt");

      expect(fs.existsSync(file1Path)).to.equal(false);
      expect(fs.existsSync(file2Path)).to.equal(false);

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });
  });
});
