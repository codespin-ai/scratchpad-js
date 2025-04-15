import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { addLoggingToServer } from "../mcp/loggingWrapper.js";
import { _setHomeDir } from "../utils/logger.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "./setup.js";
import { TestToolRegistration } from "./mcp-test-util.js";

describe("Logging Wrapper", () => {
  let testDir: string;
  let originalHomeDir: any;
  let toolRegistration: TestToolRegistration;

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();
    
    // Save original function and set mock home directory
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);
    
    // Create system config with debug enabled
    createTestConfig(testDir, { 
      projects: [],
      debug: true
    });
    
    // Set up test tool registration
    toolRegistration = new TestToolRegistration();
  });

  afterEach(() => {
    // Restore original home directory function
    _setHomeDir(originalHomeDir);
    
    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("addLoggingToServer", () => {
    it("should log successful tool calls", async () => {
      // Create a mock server with a tool handler
      const mockServer = toolRegistration.getServer();
      
      // Add a simple test tool
      mockServer.tool(
        "test_tool",
        "A test tool for logging",
        {},
        async (params: { testParam?: string }) => {
          return {
            isError: false,
            content: [{ type: "text", text: "Success" }]
          };
        }
      );
      
      // Apply logging wrapper to the mock server
      const wrapper = addLoggingToServer(mockServer);
      
      // Register our test tool again on the wrapped server
      wrapper.tool(
        "wrapped_test_tool",
        "A wrapped test tool for logging",
        {},
        async (params: { testParam?: string }) => {
          return {
            isError: false,
            content: [{ type: "text", text: "Success from wrapped tool" }]
          };
        }
      );
      
      // Execute the tool
      const testParams = { testParam: "test_value" };
      await toolRegistration.callTool("wrapped_test_tool", testParams);
      
      // Check if log files were created
      const logsDir = path.join(testDir, ".codespin", "logs");
      const requestsDir = path.join(logsDir, "requests");
      
      // Verify log directory exists
      expect(fs.existsSync(logsDir)).to.be.true;
      expect(fs.existsSync(requestsDir)).to.be.true;
      
      // Check if log files were created
      const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
      expect(logFiles.length).to.be.at.least(1);
      
      // Read the log file
      const logContent = fs.readFileSync(path.join(logsDir, logFiles[0]), 'utf8');
      expect(logContent).to.include('wrapped_test_tool');
      
      // Check request files
      const requestFiles = fs.readdirSync(requestsDir);
      expect(requestFiles.length).to.be.at.least(1);
    });
    
    it("should log error responses", async () => {
      // Create a mock server with a tool handler that throws an error
      const mockServer = toolRegistration.getServer();
      
      // Add a tool that throws an error
      mockServer.tool(
        "error_tool",
        "A tool that throws an error",
        {},
        async () => {
          throw new Error("Test error");
        }
      );
      
      // Apply logging wrapper to the mock server
      const wrapper = addLoggingToServer(mockServer);
      
      // Register our error tool again on the wrapped server
      wrapper.tool(
        "wrapped_error_tool",
        "A wrapped tool that throws an error",
        {},
        async () => {
          throw new Error("Test error from wrapped tool");
        }
      );
      
      // Execute the tool (and catch the error)
      try {
        await toolRegistration.callTool("wrapped_error_tool", {});
      } catch (error) {
        // Error is expected
      }
      
      // Check if log files were created
      const logsDir = path.join(testDir, ".codespin", "logs");
      const requestsDir = path.join(logsDir, "requests");
      
      // Check request files
      const requestFiles = fs.readdirSync(requestsDir);
      const responseFiles = requestFiles.filter(f => f.includes('_response.json'));
      
      expect(responseFiles.length).to.be.at.least(1);
      
      // Read the response file
      const responseContent = fs.readFileSync(path.join(requestsDir, responseFiles[0]), 'utf8');
      expect(responseContent).to.include('error');
      expect(responseContent).to.include('Test error');
    });
  });
});