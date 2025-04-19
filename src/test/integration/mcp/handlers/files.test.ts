// src/test/integration/mcp/handlers/files.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFileHandlers } from "../../../../mcp/handlers/files.js";
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

describe("File Handlers", function () {
  let _testDir: string;
  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let writeFileHandler: RequestHandler;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    _testDir = env.testDir;
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
        handler: unknown
      ) => {
        if (name === "write_file") {
          writeFileHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerFileHandlers(server);
  });

  afterEach(function () {
    // Clean up test environment
    cleanup();
  });

  describe("write_file", function () {
    it("should write content to a file", async function () {
      const response = await writeFileHandler({
        projectName: "test-project",
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
    });

    it("should append content to a file", async function () {
      // First write the initial content
      const initialContent = "Initial content\n";
      const filePath = path.join(projectDir, "append.txt");
      fs.writeFileSync(filePath, initialContent);

      // Now append to it
      const response = await writeFileHandler({
        projectName: "test-project",
        filePath: "append.txt",
        content: "Appended content",
        mode: "append",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Successfully appended");

      // Verify the file was updated
      expect(fs.readFileSync(filePath, "utf8")).to.equal(
        initialContent + "Appended content"
      );
    });

    it("should create directories as needed", async function () {
      const response = await writeFileHandler({
        projectName: "test-project",
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
    });

    it("should return error for invalid project", async function () {
      const response = await writeFileHandler({
        projectName: "non-existent-project",
        filePath: "test.txt",
        content: "This should fail",
        mode: "overwrite",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or unregistered project"
      );
    });

    it("should return error for invalid file path", async function () {
      const response = await writeFileHandler({
        projectName: "test-project",
        filePath: "../outside.txt",
        content: "This should fail",
        mode: "overwrite",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include("Invalid file path");
    });
  });
});
