import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { TestToolRegistration } from "../mockUtils.js";
import { _setHomeDir } from "../../utils/logger.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../setup.js";
import { SpawnSyncOptionsWithStringEncoding, spawnSync } from "child_process";

/**
 * Checks if Docker is available on the system
 * @returns True if Docker is available, false otherwise
 */
function isDockerAvailable(): boolean {
  try {
    const dockerCheck = spawnSync("docker", ["--version"]);
    return !(dockerCheck.error || dockerCheck.status !== 0);
  } catch (error) {
    return false;
  }
}

// Execute command implementation for testing with real Docker containers
async function executeInDocker(projectDir: string, command: string, dockerImage = "alpine:latest"): Promise<{
  stdout: string;
  stderr: string;
  status: number | null;
}> {
  // Construct Docker command
  const dockerCmd = [
    "docker", "run", "--rm",
    "-v", `${projectDir}:/workdir`,
    "-w", "/workdir",
    dockerImage,
    "sh", "-c", command
  ];

  // Execute Docker command
  const options: SpawnSyncOptionsWithStringEncoding = {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024, // 100MB buffer
  };

  const result = spawnSync("docker", dockerCmd.slice(1), options);

  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status
  };
}

/**
 * Tests for execute_command and execute_batch_commands tools
 */
describe("Execute Commands", function() {
  this.timeout(15000); // Docker operations can be slow
  
  let testDir: string;
  let projectPath: string;
  let originalHomeDir: any;
  let toolRegistration: TestToolRegistration;
  const dockerImage = "alpine:latest";

  beforeEach(async function() {
    // Skip tests if Docker is not available
    if (!isDockerAvailable()) {
      this.skip();
      return;
    }

    // Pull Alpine image before running tests
    const pullResult = spawnSync("docker", ["pull", dockerImage]);
    if (pullResult.error || pullResult.status !== 0) {
      this.skip();
      return;
    }
    
    // Set up test environment
    testDir = createTestEnvironment();
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);
    
    // Create project directory and test files in one batch
    projectPath = path.join(testDir, "test-project");
    fs.mkdirSync(projectPath, { recursive: true });
    
    // Create all test files in batch
    const files = [
      { path: path.join(projectPath, "test.txt"), content: "Hello, world!" },
      { path: path.join(projectPath, "test2.txt"), content: "Another test file" },
      { path: path.join(projectPath, "script.sh"), content: "#!/bin/sh\necho \"Running script\"\necho \"Arguments: $@\"\necho \"Success!\"\n" },
      { path: path.join(projectPath, "error.sh"), content: "#!/bin/sh\necho \"Error message\" >&2\nexit 1" }
    ];
    
    // Create all files at once
    files.forEach(file => {
      fs.writeFileSync(file.path, file.content);
    });
    
    // Set permissions for script files
    fs.chmodSync(path.join(projectPath, "script.sh"), 0o755);
    fs.chmodSync(path.join(projectPath, "error.sh"), 0o755);
    
    // Register project in system config
    createTestConfig(testDir, { 
      projects: [{ path: projectPath, dockerImage: dockerImage }]
    });
    
    // Set up test tool registration
    toolRegistration = new TestToolRegistration();
    
    // Register execute_command tool
    toolRegistration.registerTool(
      "execute_command", 
      async (params: { projectDir: string; command: string }) => {
        const { projectDir, command } = params;
        
        // Validate project directory
        const normalizedProjectDir = path.normalize(projectDir);
        const isRegisteredProject = normalizedProjectDir === path.normalize(projectPath);
        
        if (!isRegisteredProject) {
          return {
            content: [{ type: "text", text: `Error: Invalid or unregistered project directory: ${projectDir}` }]
          };
        }
        
        // Execute the command in Docker
        const result = await executeInDocker(projectDir, command, dockerImage);
        
        // Format the output
        let output = result.stdout;
        if (result.stderr) {
          output += "\n\nSTDERR:\n" + result.stderr;
        }
        
        return {
          content: [{ type: "text", text: output }],
          metadata: {
            status: result.status
          }
        };
      }
    );
    
    // Register execute_batch_commands tool
    toolRegistration.registerTool(
      "execute_batch_commands", 
      async (params: { projectDir: string; commands: string[]; stopOnError?: boolean }) => {
        const { projectDir, commands, stopOnError = false } = params;
        
        // Validate project directory
        const normalizedProjectDir = path.normalize(projectDir);
        const isRegisteredProject = normalizedProjectDir === path.normalize(projectPath);
        
        if (!isRegisteredProject) {
          return {
            content: [{ type: "text", text: `Error: Invalid or unregistered project directory: ${projectDir}` }]
          };
        }
        
        const results = [];
        let hasError = false;
        
        // Execute each command in sequence
        for (let i = 0; i < commands.length; i++) {
          const command = commands[i];
          const result = await executeInDocker(projectDir, command, dockerImage);
          
          // Format output for this command
          let output = result.stdout;
          if (result.stderr) {
            output += "\n\nSTDERR:\n" + result.stderr;
          }
          
          // Add to results
          results.push({
            command,
            output,
            status: result.status
          });
          
          // Check for error
          if (result.status !== 0) {
            hasError = true;
            if (stopOnError) {
              break;
            }
          }
        }
        
        // Format final output
        const finalOutput = results.map(r => {
          return `$ ${r.command}\n${r.output}${r.status !== 0 ? "\n[Command failed with exit code " + r.status + "]" : ""}`;
        }).join("\n\n");
        
        return {
          content: [{ type: "text", text: finalOutput }],
          metadata: {
            results,
            hasError
          }
        };
      }
    );
  });
  
  afterEach(() => {
    // Restore original home directory
    if (originalHomeDir) {
      _setHomeDir(originalHomeDir);
    }
    
    // Clean up test environment
    if (testDir) {
      cleanupTestEnvironment(testDir);
    }
  });
  
  describe("execute_command", function() {
    it("should execute a basic command", async function() {
      const response = await toolRegistration.callTool("execute_command", {
        projectDir: projectPath,
        command: "cat test.txt"
      });
      
      expect(response.content[0].text).to.equal("Hello, world!");
      expect(response.metadata.status).to.equal(0);
    });
    
    it("should handle command errors", async function() {
      const response = await toolRegistration.callTool("execute_command", {
        projectDir: projectPath,
        command: "cat nonexistent.txt"
      });
      
      expect(response.content[0].text).to.include("STDERR:");
      expect(response.content[0].text).to.include("No such file or directory");
      expect(response.metadata.status).to.not.equal(0);
    });
    
    it("should execute scripts with arguments", async function() {
      const response = await toolRegistration.callTool("execute_command", {
        projectDir: projectPath,
        command: "./script.sh arg1 arg2"
      });
      
      expect(response.content[0].text).to.include("Running script");
      expect(response.content[0].text).to.include("Arguments: arg1 arg2");
      expect(response.content[0].text).to.include("Success!");
      expect(response.metadata.status).to.equal(0);
    });
  });
  
  describe("execute_batch_commands", function() {
    it("should execute multiple commands in sequence", async function() {
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectDir: projectPath,
        commands: [
          "cat test.txt",
          "cat test2.txt"
        ]
      });
      
      expect(response.content[0].text).to.include("Hello, world!");
      expect(response.content[0].text).to.include("Another test file");
      expect(response.metadata.hasError).to.be.false;
    });
    
    it("should continue execution after errors by default", async function() {
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectDir: projectPath,
        commands: [
          "cat nonexistent.txt",
          "cat test.txt"
        ]
      });
      
      expect(response.content[0].text).to.include("No such file or directory");
      expect(response.content[0].text).to.include("Hello, world!");
      expect(response.metadata.hasError).to.be.true;
      expect(response.metadata.results.length).to.equal(2);
    });
    
    it("should stop execution after errors when stopOnError is true", async function() {
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectDir: projectPath,
        commands: [
          "cat nonexistent.txt",
          "cat test.txt"
        ],
        stopOnError: true
      });
      
      expect(response.content[0].text).to.include("No such file or directory");
      expect(response.content[0].text).to.not.include("Hello, world!");
      expect(response.metadata.hasError).to.be.true;
      expect(response.metadata.results.length).to.equal(1);
    });
    
    it("should preserve environment between commands", async function() {
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectDir: projectPath,
        commands: [
          "VAR=test",
          "echo $VAR"
        ]
      });
      
      expect(response.content[0].text).to.include("test");
      expect(response.metadata.hasError).to.be.false;
    });
  });
});