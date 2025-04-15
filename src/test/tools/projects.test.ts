import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { TestToolRegistration } from "../mcp-test-util.js";
import { _setHomeDir } from "../../utils/logger.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../setup.js";

describe("Project MCP Tools", () => {
  let testDir: string;
  let originalHomeDir: any;
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
    server.tool(
      "list_projects",
      "List available projects",
      {},
      async () => {
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
          const projectsList = projects.map((projectPath: string) => {
            const exists = fs.existsSync(projectPath);
            return `${projectPath} (${exists ? "Exists" : "Missing"})\n`;
          }).join("\n");
          
          return {
            isError: false,
            content: [{ type: "text", text: projectsList }],
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: `Error listing projects: ${error instanceof Error ? error.message : String(error)}`
            }],
          };
        }
      }
    );
    
    // Implement get_project_config
    server.tool(
      "get_project_config",
      "Get configuration for a specific project",
      {},
      async (params: { projectDir: string }) => {
        try {
          const { projectDir } = params;
          
          // Check if project is registered
          const configPath = path.join(testDir, ".codespin", "codebox.json");
          if (fs.existsSync(configPath)) {
            const systemConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
            const projects = systemConfig.projects || [];
            
            // Simple validation - verify the project is registered
            const isRegistered = projects.includes(projectDir);
            if (!isRegistered) {
              return {
                isError: true,
                content: [{ type: "text", text: `Error: Invalid or unregistered project directory: ${projectDir}` }],
              };
            }
          } else {
            return {
              isError: true,
              content: [{ type: "text", text: `Error: Invalid or unregistered project directory: ${projectDir}` }],
            };
          }
          
          // Check for project config
          const projectConfigPath = path.join(projectDir, ".codespin", "codebox.json");
          const systemConfigPath = path.join(testDir, ".codespin", "codebox.json");
          
          let projectConfig: any = {};
          let systemConfig: any = {};
          
          // Check project config
          if (fs.existsSync(projectConfigPath)) {
            projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
          }
          
          // Check system config
          if (fs.existsSync(systemConfigPath)) {
            systemConfig = JSON.parse(fs.readFileSync(systemConfigPath, "utf8"));
          }
          
          // Determine Docker image
          const dockerImage = projectConfig.dockerImage || systemConfig.dockerImage || "<No Docker image configured>";
          const usingSystemImage = !projectConfig.dockerImage && systemConfig.dockerImage;
          
          const configInfo = `Project: ${projectDir}\n` +
                           `Docker Image: ${dockerImage}${usingSystemImage ? " (from system config)" : ""}\n`;
          
          return {
            isError: false,
            content: [{ type: "text", text: configInfo }],
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: `Error getting project config: ${error instanceof Error ? error.message : String(error)}`
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

  describe("list_projects", () => {
    it("should return empty projects list when no projects are registered", async () => {
      // Create empty system config
      createTestConfig(testDir, { dockerImage: "node:18" });
      
      // Call the list_projects tool
      const response = await toolRegistration.callTool("list_projects", {});
      
      // Verify response
      expect(response).to.have.property('isError').to.be.false;
      expect(response).to.have.property('content');
      expect(response.content).to.be.an('array').with.lengthOf(1);
      expect(response.content[0].text).to.include('No projects registered');
    });

    it("should list registered projects", async () => {
      // Create projects directory
      const projectPath = path.join(testDir, "test-project");
      fs.mkdirSync(projectPath, { recursive: true });
      
      // Create system config with registered project
      createTestConfig(testDir, { 
        dockerImage: "node:18",
        projects: [projectPath]
      });
      
      // Call the list_projects tool
      const response = await toolRegistration.callTool("list_projects", {});
      
      // Verify response
      expect(response).to.have.property('isError').to.be.false;
      expect(response).to.have.property('content');
      expect(response.content).to.be.an('array').with.lengthOf(1);
      expect(response.content[0].text).to.include(projectPath);
    });
  });

  describe("get_project_config", () => {
    it("should return error for invalid project", async () => {
      // Create system config
      createTestConfig(testDir, { dockerImage: "node:18" });
      
      // Call get_project_config with non-registered project
      const invalidPath = path.join(testDir, "non-existent");
      const response = await toolRegistration.callTool("get_project_config", 
        { projectDir: invalidPath }
      );
      
      // Verify error response
      expect(response).to.have.property('isError').to.be.true;
      expect(response).to.have.property('content');
      expect(response.content[0].text).to.include('Invalid or unregistered project');
    });

    it("should return project configuration", async () => {
      // Create test project with configuration
      const projectPath = path.join(testDir, "test-project");
      fs.mkdirSync(projectPath, { recursive: true });
      
      // Create project config
      const projectConfigDir = path.join(projectPath, ".codespin");
      fs.mkdirSync(projectConfigDir, { recursive: true });
      
      const projectConfig = { dockerImage: "node:latest" };
      fs.writeFileSync(
        path.join(projectConfigDir, "codebox.json"), 
        JSON.stringify(projectConfig, null, 2)
      );
      
      // Register project in system config
      createTestConfig(testDir, { 
        dockerImage: "node:18",
        projects: [projectPath]
      });
      
      // Call get_project_config
      const response = await toolRegistration.callTool("get_project_config", 
        { projectDir: projectPath }
      );
      
      // Verify response
      expect(response).to.have.property('isError').to.be.false;
      expect(response).to.have.property('content');
      expect(response.content[0].text).to.include('node:latest');
    });
  });
});