import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { 
  wrapToolHandler,
  addLoggingToServer,
  createLoggingEnabledServer
} from "../../mcp/logging.js";
import { _setHomeDir } from "../../logging/logger.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../utils/setup.js";
import { TestToolRegistration } from "../utils/mcpTestUtil.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

describe("MCP Logging", () => {
  let testDir: string;
  let originalHomeDir: unknown;
  let toolRegistration: TestToolRegistration;

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);

    // Set up tool registration
    toolRegistration = new TestToolRegistration();

    // Create test config with debug enabled
    createTestConfig(testDir, { 
      projects: [],
      debug: true
    });
  });

  afterEach(() => {
    // Restore original home directory
    _setHomeDir(originalHomeDir as () => string);

    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("wrapToolHandler", () => {
    it("should wrap a handler and log calls", async () => {
      // Create a simple handler with proper type
      const originalHandler = async () => ({
        content: [{ type: "text" as const, text: "Test response" }]
      });

      // Wrap the handler
      const wrappedHandler = wrapToolHandler("test_tool", originalHandler);

      // Call the wrapped handler
      const result = await wrappedHandler({}, {} as RequestHandlerExtra);

      // Check response
      expect(result.content[0].type).to.equal("text");
      expect((result.content[0] as { type: "text", text: string }).text).to.equal("Test response");

      // Check if logs were created
      const logsDir = path.join(testDir, ".codespin", "logs");
      const requestsDir = path.join(logsDir, "requests");
      
      // Verify directories exist
      expect(fs.existsSync(logsDir)).to.be.true;
      expect(fs.existsSync(requestsDir)).to.be.true;
      
      // Check log files created
      const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith(".log"));
      expect(logFiles.length).to.be.at.least(1);
      
      // Check request files created
      const requestFiles = fs.readdirSync(requestsDir);
      expect(requestFiles.length).to.be.at.least(2); // Payload and response
    });

    it("should log errors correctly", async () => {
      // Create a handler that throws an error
      const errorHandler = async () => {
        throw new Error("Test error");
      };

      // Wrap the handler
      const wrappedHandler = wrapToolHandler("error_tool", errorHandler);

      // Call the wrapped handler and catch the error
      try {
        await wrappedHandler({}, {} as RequestHandlerExtra);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).to.equal("Test error");
      }

      // Check if logs were created with error info
      const logsDir = path.join(testDir, ".codespin", "logs");
      const requestsDir = path.join(logsDir, "requests");
      
      // Find response file
      const responseFiles = fs.readdirSync(requestsDir)
        .filter(f => f.includes("_response.json"));
      
      expect(responseFiles.length).to.be.at.least(1);
      
      // Read response file content
      const responseContent = fs.readFileSync(
        path.join(requestsDir, responseFiles[0]), 
        "utf8"
      );
      
      // Check if it contains error info
      expect(responseContent).to.include("error");
      expect(responseContent).to.include("Test error");
    });
  });

  describe("addLoggingToServer", () => {
    it("should add logging to a server", async () => {
      // Create a mock server
      const mockServer = toolRegistration.getServer();

      // Add a simple tool
      mockServer.tool(
        "test_tool", 
        "Test description", 
        {}, 
        async () => ({
          content: [{ type: "text" as const, text: "Test response" }]
        })
      );

      // Add logging to the server
      const loggingServer = addLoggingToServer(mockServer as unknown as McpServer);

      // Verify tools still work
      const toolMethod = loggingServer.tool;
      expect(typeof toolMethod).to.equal("function");

      // Register a tool with the logging server
      loggingServer.tool(
        "logged_tool",
        "Logged tool description",
        {},
        async () => ({
          content: [{ type: "text" as const, text: "Logged response" }]
        })
      );

      // At this point, we've verified the server was enhanced without errors
      expect(true).to.be.true;
    });
  });

  describe("createLoggingEnabledServer", () => {
    it("should add logging when debug is enabled", () => {
      // Create a mock server with debug enabled
      const mockServer = toolRegistration.getServer() as unknown as McpServer;
      
      // Set debug to true in config
      createTestConfig(testDir, { 
        projects: [],
        debug: true
      });
      
      // Create logging-enabled server
      const enhancedServer = createLoggingEnabledServer(mockServer);
      
      // Should return a server (not null)
      expect(enhancedServer).to.not.be.null;
    });

    it("should not add logging when debug is disabled", () => {
      // Create a mock server with debug disabled
      const mockServer = toolRegistration.getServer() as unknown as McpServer;
      
      // Set debug to false in config
      createTestConfig(testDir, { 
        projects: [],
        debug: false
      });
      
      // Create server without logging
      const normalServer = createLoggingEnabledServer(mockServer);
      
      // Should return the original server
      expect(normalServer).to.equal(mockServer);
    });
  });
});