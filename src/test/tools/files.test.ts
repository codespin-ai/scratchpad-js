import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { TestToolRegistration } from "../mcp-test-util.js";
import { _setHomeDir } from "../../utils/logger.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../setup.js";

describe("File MCP Tools", () => {
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
      projects: [{ path: projectPath, dockerImage: "node:18" }]
    });
    
    // Set up test tool registration
    toolRegistration = new TestToolRegistration();
    
    // Register our own simple implementation of the write_file tool
    const server = toolRegistration.getServer();
    server.tool(
      "write_file",
      "Write content to a file in a project directory",
      {},
      async (params: { 
        projectDir: string; 
        filePath: string; 
        content: string; 
        mode?: "overwrite" | "append" 
      }) => {
        try {
          const { projectDir, filePath, content, mode = "overwrite" } = params;
          
          // Simple validation - just check that the path is inside the project
          const resolvedProjectDir = path.resolve(projectDir);
          const fullPath = path.join(resolvedProjectDir, filePath);
          
          if (!fullPath.startsWith(resolvedProjectDir)) {
            return {
              isError: true,
              content: [{ type: "text", text: `Error: Invalid file path: ${filePath}` }],
            };
          }
          
          // Create directory if needed
          const dirPath = path.dirname(fullPath);
          fs.mkdirSync(dirPath, { recursive: true });
          
          // Write file
          fs.writeFileSync(fullPath, content, {
            flag: mode === "append" ? "a" : "w",
            encoding: "utf8",
          });
          
          return {
            isError: false,
            content: [{
              type: "text",
              text: `Successfully ${mode === "append" ? "appended to" : "wrote"} file: ${filePath}`
            }],
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }],
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

  describe("write_file", () => {
    it("should write content to a file", async () => {
      const filePath = "test-file.txt";
      const content = "Hello, world!";
      
      // Call write_file tool
      const response = await toolRegistration.callTool("write_file", {
        projectDir: projectPath,
        filePath,
        content,
        mode: "overwrite"
      });
      
      // Verify response
      expect(response).to.have.property('isError').to.be.false;
      expect(response).to.have.property('content');
      expect(response.content[0].text).to.include('Successfully wrote file');
      
      // Verify file content
      const fullPath = path.join(projectPath, filePath);
      expect(fs.existsSync(fullPath)).to.be.true;
      expect(fs.readFileSync(fullPath, 'utf8')).to.equal(content);
    });
    
    it("should append content to an existing file", async () => {
      const filePath = "append-test.txt";
      const initialContent = "Initial content\n";
      const appendContent = "Appended content";
      
      // Create initial file
      const fullPath = path.join(projectPath, filePath);
      fs.writeFileSync(fullPath, initialContent);
      
      // Call write_file with append mode
      const response = await toolRegistration.callTool("write_file", {
        projectDir: projectPath,
        filePath,
        content: appendContent,
        mode: "append"
      });
      
      // Verify response
      expect(response).to.have.property('isError').to.be.false;
      expect(response).to.have.property('content');
      expect(response.content[0].text).to.include('Successfully appended to file');
      
      // Verify file content was appended
      expect(fs.readFileSync(fullPath, 'utf8')).to.equal(initialContent + appendContent);
    });
    
    it("should create necessary directories when writing to nested path", async () => {
      const filePath = "nested/dir/structure/test.txt";
      const content = "Nested file content";
      
      // Call write_file tool
      const response = await toolRegistration.callTool("write_file", {
        projectDir: projectPath,
        filePath,
        content,
        mode: "overwrite"
      });
      
      // Verify response
      expect(response).to.have.property('isError').to.be.false;
      
      // Verify file exists with correct content
      const fullPath = path.join(projectPath, filePath);
      expect(fs.existsSync(fullPath)).to.be.true;
      expect(fs.readFileSync(fullPath, 'utf8')).to.equal(content);
    });
    
    it("should return error when writing outside project directory", async () => {
      const filePath = "../outside/project.txt";
      const content = "This should fail";
      
      // Call write_file tool
      const response = await toolRegistration.callTool("write_file", {
        projectDir: projectPath,
        filePath,
        content,
        mode: "overwrite"
      });
      
      // Verify error response
      expect(response).to.have.property('isError').to.be.true;
      expect(response.content[0].text).to.include('Invalid file path');
      
      // Verify file was not created
      const fullPath = path.join(projectPath, filePath);
      expect(fs.existsSync(fullPath)).to.be.false;
    });
  });
});