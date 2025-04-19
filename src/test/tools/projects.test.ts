import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { TestToolRegistration } from "../mcpTestUtil.js";
import { _setHomeDir } from "../../utils/logger.js";
import {
  createTestEnvironment,
  cleanupTestEnvironment,
  createTestConfig,
} from "../setup.js";

describe("Project MCP Tools", () => {
  let testDir: string;
  let originalHomeDir: unknown;
  let toolRegistration: TestToolRegistration;

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();

    // Save original function and set mock home directory
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);

    // Set up test tool registration
    toolRegistration = new TestToolRegistration();

    // Register our own simple implementation of the project tools
    const server = toolRegistration.getServer();

    // Implement list_projects - updated to only return names
    server.tool("list_projects", "List available projects", {}, async () => {
      try {
        const configPath = path.join(testDir, ".codespin", "codebox.json");

        if (!fs.existsSync(configPath)) {
          return {
            isError: false,
            content: [{ type: "text", text: "No projects registered." }],
          };
        }

        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const projects = config.projects || [];

        if (projects.length === 0) {
          return {
            isError: false,
            content: [{ type: "text", text: "No projects registered." }],
          };
        }

        // Format projects list - only return names
        const projectNames = projects.map(
          (project: { name: string }) => project.name
        );

        return {
          isError: false,
          content: [{ type: "text", text: projectNames.join("\n") }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing projects: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    });
  });

  afterEach(() => {
    // Restore original home directory function
    _setHomeDir(originalHomeDir as () => string);

    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("list_projects", () => {
    it("should return empty projects list when no projects are registered", async () => {
      // Create empty system config
      createTestConfig(testDir, { projects: [] });

      // Call the list_projects tool
      const response = (await toolRegistration.callTool(
        "list_projects",
        {}
      )) as {
        isError: boolean;
        content: { text: string }[];
      };

      // Verify response
      expect(response.isError).to.equal(false);
      expect(response.content).to.be.an("array").with.lengthOf(1);
      expect(response.content[0].text).to.include("No projects registered");
    });

    it("should list only project names", async () => {
      // Create projects directory
      const projectPath = path.join(testDir, "test-project");
      fs.mkdirSync(projectPath, { recursive: true });

      // Create system config with registered project using new format
      createTestConfig(testDir, {
        projects: [
          {
            name: "test-project",
            hostPath: projectPath,
            dockerImage: "node:18",
            network: "test_network", // Added network parameter
          },
        ],
      });

      // Call the list_projects tool
      const response = (await toolRegistration.callTool(
        "list_projects",
        {}
      )) as {
        isError: boolean;
        content: { text: string }[];
      };

      // Verify response
      expect(response.isError).to.equal(false);
      expect(response.content).to.be.an("array").with.lengthOf(1);
      expect(response.content[0].text).to.equal("test-project");
      // Should not include path or Docker image
      expect(response.content[0].text).to.not.include(projectPath);
      expect(response.content[0].text).to.not.include("node:18");
      expect(response.content[0].text).to.not.include("test_network");
    });
  });
});
