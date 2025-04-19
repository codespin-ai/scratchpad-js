import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { registerFileHandlers } from "../../../mcp/handlers/files.js";
import { _setHomeDir } from "../../../logging/logger.js";
import { TestToolRegistration } from "../../utils/mcpTestUtil.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../../utils/setup.js";

describe("Files MCP Handler", () => {
  let testDir: string;
  let projectPath: string;
  let originalHomeDir: unknown;
  let toolRegistration: TestToolRegistration;
  const projectName = "test-project";

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);

    // Create test project
    projectPath = path.join(testDir, "test-project");
    fs.mkdirSync(projectPath, { recursive: true });

    // Create test config
    createTestConfig(testDir, {
      projects: [
        {
          name: projectName,
          hostPath: projectPath,
          dockerImage: "node:18"
        }
      ]
    });

    // Set up test tool registration
    toolRegistration = new TestToolRegistration();
    const server = toolRegistration.getServer();
    registerFileHandlers(server as any);
  });

  afterEach(() => {
    // Restore original home directory
    _setHomeDir(originalHomeDir as () => string);

    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("write_file", () => {
    it("should write content to a file", async () => {
      const filePath = "test-file.txt";
      const content = "Hello, world!";

      // Call the write_file tool
      const response = await toolRegistration.callTool("write_file", {
        projectName,
        filePath,
        content,
        mode: "overwrite"
      }) as { content: { text: string }[] };

      // Verify response
      expect(response).to.have.property("content");
      expect(response.content[0].text).to.include("Successfully wrote file");

      // Verify file was created with correct content
      const fullPath = path.join(projectPath, filePath);
      expect(fs.existsSync(fullPath)).to.be.true;
      expect(fs.readFileSync(fullPath, "utf8")).to.equal(content);
    });

    it("should append content to a file", async () => {
      const filePath = "append-test.txt";
      const initialContent = "Initial content\n";
      const appendContent = "Appended content";

      // Create initial file
      fs.writeFileSync(path.join(projectPath, filePath), initialContent);

      // Call the write_file tool with append mode
      const response = await toolRegistration.callTool("write_file", {
        projectName,
        filePath,
        content: appendContent,
        mode: "append"
      }) as { content: { text: string }[] };

      // Verify response
      expect(response.content[0].text).to.include("Successfully appended to file");

      // Verify content was appended
      const fullPath = path.join(projectPath, filePath);
      expect(fs.readFileSync(fullPath, "utf8")).to.equal(initialContent + appendContent);
    });

    it("should create nested directories as needed", async () => {
      const filePath = "nested/dir/test-file.txt";
      const content = "Nested file content";

      // Call the write_file tool
      const response = await toolRegistration.callTool("write_file", {
        projectName,
        filePath,
        content
      }) as { content: { text: string }[] };

      // Verify response
      expect(response.content[0].text).to.include("Successfully wrote file");

      // Verify directories and file were created
      const fullPath = path.join(projectPath, filePath);
      expect(fs.existsSync(fullPath)).to.be.true;
      expect(fs.readFileSync(fullPath, "utf8")).to.equal(content);
    });

    it("should return error for invalid project name", async () => {
      const response = await toolRegistration.callTool("write_file", {
        projectName: "invalid-project",
        filePath: "test.txt",
        content: "Test content"
      }) as { isError: boolean; content: { text: string }[] };

      // Verify error response
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include("Invalid or unregistered project");
    });

    it("should return error for invalid file path", async () => {
      // Try to write outside project directory
      const response = await toolRegistration.callTool("write_file", {
        projectName,
        filePath: "../outside.txt",
        content: "Test content"
      }) as { isError: boolean; content: { text: string }[] };

      // Verify error response
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include("Invalid file path");
    });
  });
});