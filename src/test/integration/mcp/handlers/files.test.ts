// src/test/integration/mcp/handlers/files.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFileHandlers } from "../../../../mcp/handlers/files.js";
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

describe("File Handlers with Sessions", function () {
  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let writeFileHandler: RequestHandler;
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
        if (name === "write_file") {
          writeFileHandler = handler as RequestHandler;
        } else if (name === "open_project_session") {
          openProjectSessionHandler = handler as RequestHandler;
        } else if (name === "close_project_session") {
          closeProjectSessionHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerFileHandlers(server);
    registerProjectHandlers(server);
  });

  afterEach(function () {
    cleanup();
  });

  describe("write_file with sessions", function () {
    it("should write content to a file using a project session", async function () {
      // First, open a project session
      const openResponse = await openProjectSessionHandler({
        projectName: "test-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // Write a file using the project session
      const response = await writeFileHandler({
        projectSessionId,
        filePath: "test.txt",
        content: "Hello, world!",
        mode: "overwrite",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Successfully wrote file");

      // Verify the file was created
      const filePath = path.join(projectDir, "test.txt");
      expect(fs.existsSync(filePath)).to.equal(true);
      expect(fs.readFileSync(filePath, "utf8")).to.equal("Hello, world!");

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should append content to a file using a project session", async function () {
      // First create a file to append to
      const filePath = path.join(projectDir, "append.txt");
      fs.writeFileSync(filePath, "Initial content\n");

      // Open a project session
      const openResponse = await openProjectSessionHandler({
        projectName: "test-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // Append to the file using the project session
      const response = await writeFileHandler({
        projectSessionId,
        filePath: "append.txt",
        content: "Appended content",
        mode: "append",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Successfully appended");

      // Verify the file was updated
      expect(fs.readFileSync(filePath, "utf8")).to.equal(
        "Initial content\nAppended content"
      );

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should create directories as needed", async function () {
      // Open a project session
      const openResponse = await openProjectSessionHandler({
        projectName: "test-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // Write a file in a nested directory
      const response = await writeFileHandler({
        projectSessionId,
        filePath: "nested/dir/test.txt",
        content: "Nested content",
        mode: "overwrite",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);

      // Verify the file was created
      const filePath = path.join(projectDir, "nested/dir/test.txt");
      expect(fs.existsSync(filePath)).to.equal(true);
      expect(fs.readFileSync(filePath, "utf8")).to.equal("Nested content");

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should return error for invalid project session IDs", async function () {
      const response = await writeFileHandler({
        projectSessionId: "invalid-project session id",
        filePath: "test.txt",
        content: "This should fail",
        mode: "overwrite",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or expired project session id"
      );
    });

    it("should return error for invalid file paths", async function () {
      // Open a project session
      const openResponse = await openProjectSessionHandler({
        projectName: "test-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // Try to write to an invalid path
      const response = await writeFileHandler({
        projectSessionId,
        filePath: "../outside.txt",
        content: "This should fail",
        mode: "overwrite",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include("Invalid file path");

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });
  });

  describe("write_file with Copy Mode", function () {
    it("should write to a copy of the project and not modify original files", async function () {
      // Open a project session with copy=true
      const openResponse = await openProjectSessionHandler({
        projectName: "copy-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // Write a file using the project session
      const response = await writeFileHandler({
        projectSessionId,
        filePath: "copied-file.txt",
        content: "This file should only exist in the copy",
        mode: "overwrite",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Successfully wrote file");

      // Verify the file was NOT created in the original project directory
      const filePath = path.join(projectDir, "copied-file.txt");
      expect(fs.existsSync(filePath)).to.equal(false);

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });

    it("should allow multiple write operations in the same project session", async function () {
      // Open a project session with copy=true
      const openResponse = await openProjectSessionHandler({
        projectName: "copy-project",
      });

      const projectSessionId = openResponse.content[0].text;

      // Write first file
      await writeFileHandler({
        projectSessionId,
        filePath: "multi-file1.txt",
        content: "First file content",
        mode: "overwrite",
      });

      // Write second file
      await writeFileHandler({
        projectSessionId,
        filePath: "multi-file2.txt",
        content: "Second file content",
        mode: "overwrite",
      });

      // Modify first file
      await writeFileHandler({
        projectSessionId,
        filePath: "multi-file1.txt",
        content: " - Appended content",
        mode: "append",
      });

      // Neither file should exist in the original project directory
      expect(fs.existsSync(path.join(projectDir, "multi-file1.txt"))).to.equal(
        false
      );
      expect(fs.existsSync(path.join(projectDir, "multi-file2.txt"))).to.equal(
        false
      );

      // Clean up the project session
      await closeProjectSessionHandler({
        projectSessionId,
      });
    });
  });
});
