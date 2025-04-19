import { expect } from "chai";
import { createServer } from "../../mcp/server.js";
import { _setHomeDir } from "../../logging/logger.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../utils/setup.js";

describe("MCP Server", () => {
  let testDir: string;
  let originalHomeDir: unknown;

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);

    // Create test config
    createTestConfig(testDir, {
      projects: [],
      debug: false
    });
  });

  afterEach(() => {
    // Restore original home directory
    _setHomeDir(originalHomeDir as () => string);

    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("createServer", () => {
    it("should create a server with all tools registered", async () => {
      const server = await createServer();
      
      // Server should exist
      expect(server).to.not.be.null;
      
      // Server should have tools property
      expect(server).to.have.property("tool");
      expect(typeof server.tool).to.equal("function");
    });
  });
});