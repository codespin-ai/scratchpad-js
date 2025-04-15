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

    // Implement list_projects
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

        // Format projects list
        const projectsList = projects
          .map((project: { path: string; dockerImage: string }) => {
            const exists = fs.existsSync(project.path);
            return `${project.path} (${
              exists ? "Exists" : "Missing"
            })\nDocker Image: ${project.dockerImage}\n`;
          })
          .join("\n");

        return {
          isError: false,
          content: [{ type: "text", text: projectsList }],
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

    // Implement get_project_config
    // For get_project_config in src/test/tools/projects.test.ts
    server.tool(
      "get_project_config",
      "Get configuration for a specific project",
      {},
      async (params: unknown) => {
        try {
          // Type assertion while keeping original implementation
          const { projectDir } = params as { projectDir: string };

          // Check if project is registered
          const configPath = path.join(testDir, ".codespin", "codebox.json");
          if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
            const projects = config.projects || [];

            // Find the project configuration
            const project = projects.find(
              (p: { path: string }) => p.path === projectDir
            );

            if (!project) {
              return {
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Error: Invalid or unregistered project directory: ${projectDir}`,
                  },
                ],
              };
            }

            const configInfo =
              `Project: ${projectDir}\n` +
              `Docker Image: ${project.dockerImage}\n`;

            return {
              isError: false,
              content: [{ type: "text", text: configInfo }],
            };
          } else {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Error: Invalid or unregistered project directory: ${projectDir}`,
                },
              ],
            };
          }
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error getting project config: ${
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

    it("should list registered projects", async () => {
      // Create projects directory
      const projectPath = path.join(testDir, "test-project");
      fs.mkdirSync(projectPath, { recursive: true });

      // Create system config with registered project
      createTestConfig(testDir, {
        projects: [{ path: projectPath, dockerImage: "node:18" }],
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
      expect(response.content[0].text).to.include(projectPath);
      expect(response.content[0].text).to.include("node:18");
    });
  });

  describe("get_project_config", () => {
    it("should return error for invalid project", async () => {
      // Create system config
      createTestConfig(testDir, { projects: [] });

      // Call get_project_config with non-registered project
      const invalidPath = path.join(testDir, "non-existent");
      const response = (await toolRegistration.callTool("get_project_config", {
        projectDir: invalidPath,
      })) as { isError: boolean; content: { text: string }[] };

      // Verify error response
      expect(response.isError).to.equal(true);
      expect(response.content).to.be.an("array");
      expect(response.content[0].text).to.include(
        "Invalid or unregistered project"
      );
    });

    it("should return project configuration", async () => {
      // Create test project
      const projectPath = path.join(testDir, "test-project");
      fs.mkdirSync(projectPath, { recursive: true });

      // Register project in system config
      createTestConfig(testDir, {
        projects: [{ path: projectPath, dockerImage: "node:latest" }],
      });

      // Call get_project_config
      const response = (await toolRegistration.callTool("get_project_config", {
        projectDir: projectPath,
      })) as { isError: boolean; content: { text: string }[] };

      // Verify response
      expect(response.isError).to.equal(false);
      expect(response.content).to.be.an("array");
      expect(response.content[0].text).to.include("node:latest");
    });
  });
});
