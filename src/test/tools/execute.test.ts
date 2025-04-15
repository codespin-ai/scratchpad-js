import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { TestToolRegistration } from "../mcp-test-util.js";
import { _setHomeDir } from "../../utils/logger.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "../setup.js";
import { SpawnSyncOptionsWithStringEncoding, spawnSync } from "child_process";

// Execute command implementation for testing with real Docker containers
async function executeInDocker(projectDir: string, command: string, dockerImage: string = "alpine:latest"): Promise<{
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

describe("Execute MCP Tools", function() {
  // Extend timeout for Docker operations
  this.timeout(15000);
  
  let testDir: string;
  let projectPath: string;
  let originalHomeDir: any;
  let toolRegistration: TestToolRegistration;
  const dockerImage = "alpine:latest";

  beforeEach(async function() {
    // Skip tests if Docker is not available
    const dockerCheck = spawnSync("docker", ["--version"]);
    if (dockerCheck.error || dockerCheck.status !== 0) {
      this.skip();
    }

    // Pull Alpine image before running tests
    const pullResult = spawnSync("docker", ["pull", dockerImage]);
    if (pullResult.error || pullResult.status !== 0) {
      this.skip();
    }
    
    // Set up test environment
    testDir = createTestEnvironment();
    
    // Save original function and set mock home directory
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);
    
    // Create test project
    projectPath = path.join(testDir, "test-project");
    fs.mkdirSync(projectPath, { recursive: true });
    
    // Create a test file in the project
    fs.writeFileSync(path.join(projectPath, "test.txt"), "hello world");
    
    // Create a test script
    fs.writeFileSync(path.join(projectPath, "test.sh"), "#!/bin/sh\necho \"Script output\"\nexit 0");
    fs.chmodSync(path.join(projectPath, "test.sh"), 0o755);
    
    // Create error script
    fs.writeFileSync(path.join(projectPath, "error.sh"), "#!/bin/sh\necho \"Error message\" >&2\nexit 1");
    fs.chmodSync(path.join(projectPath, "error.sh"), 0o755);
    
    // Register project in system config
    createTestConfig(testDir, { 
      dockerImage: dockerImage,
      projects: [projectPath]
    });
    
    // Set up test tool registration
    toolRegistration = new TestToolRegistration();
    
    // Register our own implementation of the execute_command tool using real Docker
    const server = toolRegistration.getServer();
    server.tool(
      "execute_command",
      "Execute a command in a Docker container for a specific project",
      {},
      async (params: { projectDir: string; command: string }) => {
        try {
          const { projectDir, command } = params;
          
          // Validate project directory (simplified validation for tests)
          if (!fs.existsSync(projectDir)) {
            return {
              isError: true,
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
          
          // Return success or error based on exit code
          if (result.status === 0) {
            return {
              isError: false,
              content: [{ type: "text", text: output }]
            };
          } else {
            return {
              isError: true,
              content: [{ type: "text", text: `Command failed with exit code ${result.status}\n\n${output}` }]
            };
          }
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error executing command: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );
    
    // Register batch command tool
    server.tool(
      "execute_batch_commands",
      "Execute multiple commands in sequence within a Docker container for a specific project",
      {},
      async (params: { projectDir: string; commands: string[]; stopOnError?: boolean }) => {
        try {
          const { projectDir, commands, stopOnError = true } = params;
          
          // Validate project directory (simplified validation for tests)
          if (!fs.existsSync(projectDir)) {
            return {
              isError: true,
              content: [{ type: "text", text: `Error: Invalid or unregistered project directory: ${projectDir}` }]
            };
          }
          
          // Prepare results array
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
            
            const successful = result.status === 0;
            results.push({
              command,
              output,
              exitCode: result.status,
              successful
            });
            
            // Handle error if stopOnError is true
            if (!successful) {
              hasError = true;
              if (stopOnError) {
                break;
              }
            }
          }
          
          // Format the overall results
          const formattedResults = results.map((result, index) => {
            return `Command ${index + 1}: ${result.command}\n` +
                  `Exit Code: ${result.exitCode}\n` +
                  `Status: ${result.successful ? 'Success' : 'Failed'}\n` +
                  `Output:\n${result.output}\n` +
                  "----------------------------------------\n";
          }).join("\n");
          
          return {
            isError: hasError && stopOnError,
            content: [{ type: "text", text: formattedResults }]
          };
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error executing batch commands: ${error instanceof Error ? error.message : String(error)}` }]
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

  describe("execute_command", () => {
    it("should execute a simple command and return output", async function() {
      // Execute a simple echo command
      const response = await toolRegistration.callTool("execute_command", {
        projectDir: projectPath,
        command: "echo 'test output'"
      });
      
      // Verify response
      expect(response).to.have.property('isError').to.be.false;
      expect(response.content[0].text).to.include('test output');
    });
    
    it("should return file contents correctly", async function() {
      const response = await toolRegistration.callTool("execute_command", {
        projectDir: projectPath,
        command: "cat test.txt"
      });
      
      expect(response).to.have.property('isError').to.be.false;
      expect(response.content[0].text).to.include('hello world');
    });
    
    it("should execute a script correctly", async function() {
      const response = await toolRegistration.callTool("execute_command", {
        projectDir: projectPath,
        command: "./test.sh"
      });
      
      expect(response).to.have.property('isError').to.be.false;
      expect(response.content[0].text).to.include('Script output');
    });
    
    it("should handle commands that produce errors", async function() {
      const response = await toolRegistration.callTool("execute_command", {
        projectDir: projectPath,
        command: "./error.sh"
      });
      
      expect(response).to.have.property('isError').to.be.true;
      expect(response.content[0].text).to.include('Command failed with exit code 1');
      expect(response.content[0].text).to.include('Error message');
    });
    
    it("should handle commands that produce both stdout and stderr", async function() {
      const response = await toolRegistration.callTool("execute_command", {
        projectDir: projectPath,
        command: "echo 'standard output' && echo 'error output' >&2"
      });
      
      expect(response).to.have.property('isError').to.be.false;
      expect(response.content[0].text).to.include('standard output');
      expect(response.content[0].text).to.include('STDERR');
      expect(response.content[0].text).to.include('error output');
    });
    
    it("should handle environment variables", async function() {
      const response = await toolRegistration.callTool("execute_command", {
        projectDir: projectPath,
        command: "TEST_VAR='hello' && echo $TEST_VAR"
      });
      
      expect(response).to.have.property('isError').to.be.false;
      expect(response.content[0].text).to.include('hello');
    });
    
    it("should return error for invalid project directory", async function() {
      const invalidPath = path.join(testDir, "non-existent");
      const response = await toolRegistration.callTool("execute_command", {
        projectDir: invalidPath,
        command: "echo 'test'"
      });
      
      expect(response).to.have.property('isError').to.be.true;
      expect(response.content[0].text).to.include('Invalid or unregistered project directory');
    });
  });

  describe("execute_batch_commands", () => {
    it("should execute multiple commands in sequence", async function() {
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectDir: projectPath,
        commands: [
          "echo 'command 1'",
          "echo 'command 2'",
          "echo 'command 3'"
        ]
      });
      
      expect(response).to.have.property('isError').to.be.false;
      expect(response.content[0].text).to.include('command 1');
      expect(response.content[0].text).to.include('command 2');
      expect(response.content[0].text).to.include('command 3');
      expect(response.content[0].text).to.include('Exit Code: 0');
    });
    
    it("should stop execution on error when stopOnError is true", async function() {
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectDir: projectPath,
        commands: [
          "echo 'first command'",
          "./error.sh",  // This will fail
          "echo 'should not run'"  // This should not execute
        ],
        stopOnError: true
      });
      
      expect(response).to.have.property('isError').to.be.true;
      expect(response.content[0].text).to.include('first command');
      expect(response.content[0].text).to.include('Error message');
      expect(response.content[0].text).to.not.include('should not run');
    });
    
    it("should continue execution on error when stopOnError is false", async function() {
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectDir: projectPath,
        commands: [
          "echo 'first command'",
          "./error.sh",  // This will fail
          "echo 'should still run'"  // This should still execute
        ],
        stopOnError: false
      });
      
      expect(response.content[0].text).to.include('first command');
      expect(response.content[0].text).to.include('Error message');
      expect(response.content[0].text).to.include('should still run');
    });
    
    it("should preserve state between commands", async function() {
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectDir: projectPath,
        commands: [
          "echo 'state test' > state.txt",
          "cat state.txt"
        ]
      });
      
      expect(response).to.have.property('isError').to.be.false;
      expect(response.content[0].text).to.include('state test');
    });
    
    it("should preserve environment variables between commands", async function() {
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectDir: projectPath,
        commands: [
          "export TEST_VAR='preserved value'",
          "echo $TEST_VAR"
        ]
      });
      
      expect(response).to.have.property('isError').to.be.false;
      expect(response.content[0].text).to.include('preserved value');
    });
    
    it("should return error for invalid project directory", async function() {
      const invalidPath = path.join(testDir, "non-existent");
      const response = await toolRegistration.callTool("execute_batch_commands", {
        projectDir: invalidPath,
        commands: ["echo 'test'"]
      });
      
      expect(response).to.have.property('isError').to.be.true;
      expect(response.content[0].text).to.include('Invalid or unregistered project directory');
    });
  });
});