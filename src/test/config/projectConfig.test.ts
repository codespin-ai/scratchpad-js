import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { 
  getConfigFilePath, 
  getConfig, 
  saveConfig, 
  getProjects, 
  getProjectByName, 
  validateProjectName,
  isDebugEnabled
} from "../../config/projectConfig.js";
import { _setHomeDir } from "../../logging/logger.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../utils/setup.js";

describe("Project Configuration", () => {
  let testDir: string;
  let originalHomeDir: unknown;

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();

    // Save original function
    originalHomeDir = _setHomeDir;

    // Set mock home directory - this is critical to making tests work in isolation
    _setHomeDir(() => testDir);
  });

  afterEach(() => {
    // Restore original function
    _setHomeDir(originalHomeDir as () => string);

    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("getConfigFilePath", () => {
    it("should return the correct config file path", () => {
      const configPath = getConfigFilePath();
      const expectedPath = path.join(testDir, ".codespin", "codebox.json");
      expect(configPath).to.equal(expectedPath);
    });

    it("should create the config directory if it doesn't exist", () => {
      // Delete the config directory first if it exists
      const configDir = path.join(testDir, ".codespin");
      if (fs.existsSync(configDir)) {
        fs.rmSync(configDir, { recursive: true, force: true });
      }

      // Call the function to create the directory
      getConfigFilePath();

      // Check if the directory was created
      expect(fs.existsSync(configDir)).to.equal(true);
    });
  });

  describe("getConfig and saveConfig", () => {
    it("should return an empty config if file doesn't exist", () => {
      // Delete any existing config file first
      const configFile = getConfigFilePath();
      if (fs.existsSync(configFile)) {
        fs.unlinkSync(configFile);
      }
      
      const config = getConfig();
      expect(config).to.deep.equal({ projects: [] });
    });

    it("should save and retrieve a config file", () => {
      const testConfig = {
        projects: [
          {
            name: "test-project",
            hostPath: "/path/to/project",
            dockerImage: "node:14",
          },
        ],
        debug: true,
      };

      // Save the config
      saveConfig(testConfig);

      // Get the config and check if it matches
      const retrievedConfig = getConfig();
      expect(retrievedConfig).to.deep.equal(testConfig);
    });
  });

  describe("getProjects", () => {
    it("should return all projects from config", () => {
      // Create test config with two projects
      const projectConfigs = [
        {
          name: "project1",
          hostPath: "/path/to/project1",
          dockerImage: "node:14"
        },
        {
          name: "project2",
          hostPath: "/path/to/project2",
          containerName: "test-container"
        }
      ];
      
      saveConfig({ 
        projects: projectConfigs
      });

      // Get projects
      const projects = getProjects();
      
      // Check if we got the correct projects
      expect(projects).to.have.lengthOf(2);
      expect(projects[0].name).to.equal("project1");
      expect(projects[1].name).to.equal("project2");
    });
  });

  describe("getProjectByName", () => {
    it("should return a project by name", () => {
      // Create test config with a project
      saveConfig({
        projects: [
          {
            name: "project2",
            hostPath: "/path/to/project2",
            containerName: "test-container"
          }
        ]
      });

      // Get project by name
      const project = getProjectByName("project2");
      
      // Check if we got the correct project
      expect(project).to.not.be.null;
      expect(project?.name).to.equal("project2");
      expect(project?.containerName).to.equal("test-container");
    });

    it("should return null for a non-existent project", () => {
      // Create empty config
      saveConfig({ projects: [] });
      
      const project = getProjectByName("non-existent");
      expect(project).to.be.null;
    });
  });

  describe("validateProjectName", () => {
    it("should return false for a non-existent project", () => {
      // Create empty config
      saveConfig({ projects: [] });
      
      const result = validateProjectName("non-existent");
      expect(result).to.be.false;
    });

    it("should return false if project directory doesn't exist", () => {
      // Create test config with a project pointing to a non-existent directory
      saveConfig({
        projects: [
          {
            name: "test-project",
            hostPath: path.join(testDir, "non-existent-dir"),
            dockerImage: "node:14"
          }
        ]
      });

      const result = validateProjectName("test-project");
      expect(result).to.be.false;
    });

    it("should return true for valid projects", () => {
      // Create a test project directory
      const projectPath = path.join(testDir, "valid-project");
      fs.mkdirSync(projectPath, { recursive: true });

      // Create test config with a valid project
      saveConfig({
        projects: [
          {
            name: "valid-project",
            hostPath: projectPath,
            dockerImage: "node:14"
          }
        ]
      });

      const result = validateProjectName("valid-project");
      expect(result).to.be.true;
    });
  });

  describe("isDebugEnabled", () => {
    it("should return false when debug is not set", () => {
      // Create config without debug setting
      saveConfig({ projects: [] });
      
      expect(isDebugEnabled()).to.be.false;
    });

    it("should return false when debug is explicitly set to false", () => {
      // Create config with debug=false
      saveConfig({ projects: [], debug: false });
      
      expect(isDebugEnabled()).to.be.false;
    });

    it("should return true when debug is set to true", () => {
      // Create config with debug=true
      saveConfig({ projects: [], debug: true });
      
      expect(isDebugEnabled()).to.be.true;
    });
  });
});