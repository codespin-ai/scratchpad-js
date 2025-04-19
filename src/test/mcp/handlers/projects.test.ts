import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { registerProjectHandlers } from "../../../mcp/handlers/projects.js";
import { _setHomeDir } from "../../../logging/logger.js";
import { TestToolRegistration } from "../../utils/mcpTestUtil.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../../utils/setup.js";

describe("Projects MCP Handler", () => {
  let testDir: string;
  let originalHomeDir: unknown;
  let toolRegistration: TestToolRegistration;

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);

    // Set up test tool registration
    toolRegistration = new TestToolRegistration();
    const server = toolRegistration.getServer();
    registerProjectHandlers(server as any);
  });

  afterEach(() => {
    // Restore original home directory
    _setHomeDir(originalHomeDir as () => string);

    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("list_projects", () => {
    it("should return a message when no projects are registered", async () => {
      // Create empty config
      createTestConfig(testDir, { projects: [] });

      // Call the list_projects tool
      const response = await toolRegistration.callTool("list_projects", {}) as {
        content: { text: string }[];
      };

      // Verify response
      expect(response.content[0].text).to.include("No projects are registered");
    });

    it("should list project names", async () => {
      // Create projects directory
      const projectPaths = [
        path.join(testDir, "project1"),
        path.join(testDir, "project2")
      ];
      
      projectPaths.forEach(dir => fs.mkdirSync(dir, { recursive: true }));

      // Create config with projects
      createTestConfig(testDir, {
        projects: [
          {
            name: "project1",
            hostPath: projectPaths[0],
            dockerImage: "node:14"
          },
          {
            name: "project2",
            hostPath: projectPaths[1],
            containerName: "test-container"
          }
        ]
      });

      // Call the list_projects tool
      const response = await toolRegistration.callTool("list_projects", {}) as {
        content: { text: string }[];
      };

      // Verify response contains both project names
      expect(response.content[0].text).to.include("project1");
      expect(response.content[0].text).to.include("project2");
      
      // Should just be a simple list of names, not full details
      expect(response.content[0].text).to.not.include("hostPath");
      expect(response.content[0].text).to.not.include("dockerImage");
    });
  });
});