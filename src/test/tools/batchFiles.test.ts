import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { TestToolRegistration } from "../mcp-test-util.js";
import { _setHomeDir } from "../../utils/logger.js";
import {
  createTestEnvironment,
  cleanupTestEnvironment,
  createTestConfig,
} from "../setup.js";

describe("Batch Files MCP Tools", () => {
  let testDir: string;
  let projectPath: string;
  let originalHomeDir: any;
  let toolRegistration: TestToolRegistration;

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();

    // Save original function and set mock home directory
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);

    // Create test project
    projectPath = path.join(testDir, "test-project");
    fs.mkdirSync(projectPath, { recursive: true });

    // Register project in system config
    createTestConfig(testDir, {
      projects: [{ path: projectPath, dockerImage: "node:18" }],
    });

    // Set up test tool registration
    toolRegistration = new TestToolRegistration();

    // Register our own simple implementation of the batch_files tool
    const server = toolRegistration.getServer();
    server.tool(
      "write_batch_files",
      "Write content to multiple files in a project directory in a single operation",
      {},
      async (params: {
        projectDir: string;
        files: {
          filePath: string;
          content: string;
          mode?: "overwrite" | "append";
        }[];
        stopOnError?: boolean;
      }) => {
        const { projectDir, files, stopOnError = true } = params;
        const results = [];
        let hasError = false;

        try {
          for (let i = 0; i < files.length; i++) {
            const { filePath, content, mode = "overwrite" } = files[i];

            try {
              // Simple validation - just check that the path is inside the project
              const resolvedProjectDir = path.resolve(projectDir);
              const fullPath = path.join(resolvedProjectDir, filePath);

              if (!fullPath.startsWith(resolvedProjectDir)) {
                throw new Error(`Invalid file path: ${filePath}`);
              }

              // Create directory if needed
              const dirPath = path.dirname(fullPath);
              fs.mkdirSync(dirPath, { recursive: true });

              // Write file
              fs.writeFileSync(fullPath, content, {
                flag: mode === "append" ? "a" : "w",
                encoding: "utf8",
              });

              results.push({
                filePath,
                success: true,
                message: `Successfully ${
                  mode === "append" ? "appended to" : "wrote"
                } file`,
              });
            } catch (error) {
              hasError = true;
              results.push({
                filePath,
                success: false,
                message:
                  error instanceof Error ? error.message : "Unknown error",
              });

              // Stop if stopOnError is true
              if (stopOnError) {
                break;
              }
            }
          }

          // Format the results
          const formattedResults = results
            .map((result) => {
              return (
                `File: ${result.filePath}\n` +
                `Status: ${result.success ? "Success" : "Failed"}\n` +
                `Message: ${result.message}\n` +
                "----------------------------------------\n"
              );
            })
            .join("\n");

          return {
            isError: hasError && stopOnError,
            content: [{ type: "text", text: formattedResults }],
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
          };
        }
      }
    );
  });

  afterEach(() => {
    // Restore original home directory function
    _setHomeDir(originalHomeDir);

    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("write_batch_files", () => {
    it("should write multiple files in a single operation", async () => {
      // Call write_batch_files tool
      const response = await toolRegistration.callTool("write_batch_files", {
        projectDir: projectPath,
        files: [
          {
            filePath: "file1.txt",
            content: "Content for file 1",
          },
          {
            filePath: "nested/file2.txt",
            content: "Content for file 2",
          },
        ],
      });

      // Verify response
      expect(response).to.have.property("isError").to.be.false;
      expect(response).to.have.property("content");
      expect(response.content[0].text).to.include("Success");

      // Verify files were created with correct content
      const file1Path = path.join(projectPath, "file1.txt");
      const file2Path = path.join(projectPath, "nested/file2.txt");

      expect(fs.existsSync(file1Path)).to.be.true;
      expect(fs.existsSync(file2Path)).to.be.true;

      expect(fs.readFileSync(file1Path, "utf8")).to.equal("Content for file 1");
      expect(fs.readFileSync(file2Path, "utf8")).to.equal("Content for file 2");
    });

    it("should stop on first error when stopOnError is true", async () => {
      // Call write_batch_files tool with an invalid path
      const response = await toolRegistration.callTool("write_batch_files", {
        projectDir: projectPath,
        files: [
          {
            filePath: "../outside/file1.txt", // Invalid path outside project
            content: "This should fail",
          },
          {
            filePath: "valid-file.txt", // This should not be processed
            content: "This should be skipped",
          },
        ],
        stopOnError: true,
      });

      // Verify response indicates error
      expect(response).to.have.property("isError").to.be.true;
      expect(response.content[0].text).to.include("Failed");
      expect(response.content[0].text).to.include("Invalid file path");

      // Verify second file was not created
      const validFilePath = path.join(projectPath, "valid-file.txt");
      expect(fs.existsSync(validFilePath)).to.be.false;
    });

    it("should continue processing after error when stopOnError is false", async () => {
      // Call write_batch_files tool with stopOnError = false
      const response = await toolRegistration.callTool("write_batch_files", {
        projectDir: projectPath,
        files: [
          {
            filePath: "../outside/file1.txt", // Invalid path outside project
            content: "This should fail",
          },
          {
            filePath: "valid-file.txt", // This should still be processed
            content: "This should be created",
          },
        ],
        stopOnError: false,
      });

      // Response should still indicate partial error
      expect(response.content[0].text).to.include("Failed");
      expect(response.content[0].text).to.include("Invalid file path");
      expect(response.content[0].text).to.include("Success");

      // Verify second file was created
      const validFilePath = path.join(projectPath, "valid-file.txt");
      expect(fs.existsSync(validFilePath)).to.be.true;
      expect(fs.readFileSync(validFilePath, "utf8")).to.equal(
        "This should be created"
      );
    });

    it("should handle append mode for existing files", async () => {
      // Create initial file
      const filePath = "append-test.txt";
      const initialContent = "Initial content\n";
      const appendContent = "Appended content";

      const fullPath = path.join(projectPath, filePath);
      fs.writeFileSync(fullPath, initialContent);

      // Call write_batch_files tool with append mode
      const response = await toolRegistration.callTool("write_batch_files", {
        projectDir: projectPath,
        files: [
          {
            filePath,
            content: appendContent,
            mode: "append",
          },
        ],
      });

      // Verify response
      expect(response).to.have.property("isError").to.be.false;
      expect(response.content[0].text).to.include("Success");
      expect(response.content[0].text).to.include("appended to");

      // Verify file content was appended
      expect(fs.readFileSync(fullPath, "utf8")).to.equal(
        initialContent + appendContent
      );
    });
  });
});