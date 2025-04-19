// src/test/integration/mcp/handlers/projects.test.ts
import { expect } from "chai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectHandlers } from "../../../../mcp/handlers/projects.js";
import { setupTestEnvironment, createTestConfig } from "../../setup.js";

// Mock request handler type
interface RequestHandler {
  (args: Record<string, any>): Promise<any>;
}

describe("Project Handlers", function() {
  let testDir: string;
  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let listProjectsHandler: RequestHandler;

  beforeEach(function() {
    // Setup test environment
    const env = setupTestEnvironment();
    testDir = env.testDir;
    configDir = env.configDir;
    projectDir = env.projectDir;
    cleanup = env.cleanup;

    // Create a simple server to register handlers
    const server = {
      tool: (name: string, description: string, schema: object, handler: any) => {
        if (name === "list_projects") {
          listProjectsHandler = handler;
        }
      }
    } as unknown as McpServer;

    // Register the handlers
    registerProjectHandlers(server);
  });

  afterEach(function() {
    // Clean up test environment
    cleanup();
  });

  describe("list_projects", function() {
    it("should return an empty list when no projects are registered", async function() {
      const response = await listProjectsHandler({});

      // Verify the response
      expect(response.isError).to.be.undefined;
      expect(response.content[0].text).to.include("No projects are registered");
    });

    it("should list all registered projects", async function() {
      // Register some projects in the config
      createTestConfig(configDir, {
        projects: [
          {
            name: "project1",
            hostPath: `${projectDir}/project1`,
            dockerImage: "image1"
          },
          {
            name: "project2",
            hostPath: `${projectDir}/project2`,
            containerName: "container2"
          }
        ]
      });

      const response = await listProjectsHandler({});

      // Verify the response
      expect(response.isError).to.be.undefined;
      expect(response.content[0].text).to.include("project1");
      expect(response.content[0].text).to.include("project2");
    });
  });
});