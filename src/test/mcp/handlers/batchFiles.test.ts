import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { registerBatchFileHandlers } from "../../../mcp/handlers/batchFiles.js";
import { _setHomeDir } from "../../../logging/logger.js";
import { TestToolRegistration } from "../../utils/mcpTestUtil.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../../utils/setup.js";

describe("Batch Files MCP Handler", () => {
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
    registerBatchFileHandlers(server as any);
  });

  afterEach(() => {
    // Restore original home directory
    _setHomeDir(originalHomeDir as () => string);

    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("write_batch_files", () => {
    it("should write multiple files in a single operation", async () => {
      // Call the write_batch_files tool
      const response = await toolRegistration.callTool("write_batch_files", {
        projectName,
        files: [
          {
            filePath: "file1.txt",
            content: "Content for file 1"
          },
          {
            filePath: "nested/file2.txt",
            content: "Content for file 2"
          }
        ]
      }) as { isError: boolean; content: { text: string }[] };

      // Verify response
      expect(response.isError).to.be.false;
      expect(response.content[0].text).to.include("Success");

      // Verify files were created with correct content
      const file1Path = path.join(projectPath, "file1.txt");
      const file2Path = path.join(projectPath, "nested/file2.txt");

      expect(fs.existsSync(file1Path)).to.be.true;
      expect(fs.existsSync(file2Path)).to.be.true;

      expect(fs.readFileSync(file1Path, "utf8")).to.equal("Content for file 1");
      expect(fs.readFileSync(file2Path, "utf8")).to.equal("Content for file 2");
    });

    it("should append content when mode is append", async () => {
      // Create initial file
      const filePath = "append-test.txt";
      const initialContent = "Initial content\n";
      fs.writeFileSync(path.join(projectPath, filePath), initialContent);

      // Call the write_batch_files tool with append mode
      const response = await toolRegistration.callTool("write_batch_files", {
        projectName,
        files: [
          {
            filePath,
            content: "Appended content",
            mode: "append"
          }
        ]
      }) as { isError: boolean; content: { text: string }[] };

      // Verify response
      expect(response.isError).to.be.false;
      expect(response.content[0].text).to.include("Success");

      // Verify content was appended
      const fullPath = path.join(projectPath, filePath);
      expect(fs.readFileSync(fullPath, "utf8")).to.equal(initialContent + "Appended content");
    });

    it("should stop on first error when stopOnError is true", async () => {
      // Call write_batch_files with an invalid path
      const response = await toolRegistration.callTool("write_batch_files", {
        projectName,
        files: [
          {
            filePath: "../outside.txt", // Invalid path outside project
            content: "This should fail"
          },
          {
            filePath: "valid.txt", // This should not be processed
            content: "This should be skipped"
          }
        ],
        stopOnError: true
      }) as { isError: boolean; content: { text: string }[] };

      // Verify error response
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include("Failed");
      expect(response.content[0].text).to.include("Invalid file path");

      // Verify second file was not created
      const validPath = path.join(projectPath, "valid.txt");
      expect(fs.existsSync(validPath)).to.be.false;
    });

    it("should continue after errors when stopOnError is false", async () => {
      // Call write_batch_files with stopOnError = false
      const response = await toolRegistration.callTool("write_batch_files", {
        projectName,
        files: [
          {
            filePath: "../outside.txt", // Invalid path outside project
            content: "This should fail"
          },
          {
            filePath: "valid.txt", // This should still be processed
            content: "This should be created"
          }
        ],
        stopOnError: false
      }) as { isError: boolean; content: { text: string }[] };

      // Verify response shows both success and failure
      expect(response.content[0].text).to.include("Failed");
      expect(response.content[0].text).to.include("Success");

      // Verify valid file was created
      const validPath = path.join(projectPath, "valid.txt");
      expect(fs.existsSync(validPath)).to.be.true;
      expect(fs.readFileSync(validPath, "utf8")).to.equal("This should be created");
    });

    it("should return error for invalid project name", async () => {
      // Call with invalid project name
      const response = await toolRegistration.callTool("write_batch_files", {
        projectName: "invalid-project",
        files: [
          {
            filePath: "test.txt",
            content: "Test content"
          }
        ]
      }) as { isError: boolean; content: { text: string }[] };

      // Verify error response
      expect(response.isError).to.be.true;
      expect(response.content[0].text).to.include("Invalid or unregistered project");
    });
  });
});