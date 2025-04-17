// src/test/tools/containerExecute.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { execSync, spawnSync } from "child_process";
import { TestToolRegistration } from "../mcpTestUtil.js";
import { _setHomeDir } from "../../utils/logger.js";
import {
  createTestEnvironment,
  cleanupTestEnvironment,
  createTestConfig,
} from "../setup.js";

/**
 * Checks if Docker is available on the system
 */
function isDockerAvailable(): boolean {
  try {
    const dockerCheck = spawnSync("docker", ["--version"]);
    return !(dockerCheck.error || dockerCheck.status !== 0);
  } catch {
    return false;
  }
}

/**
 * Execute a command in a running container and return the result
 */
async function executeInContainer(
  containerName: string,
  command: string
): Promise<{ stdout: string; stderr: string; status: number }> {
  try {
    // Execute command in the running container
    const result = execSync(`docker exec ${containerName} sh -c "${command}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return {
      stdout: result.toString(),
      stderr: "",
      status: 0,
    };
  } catch (error) {
    const execError = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      stdout: execError.stdout?.toString() || "",
      stderr: execError.stderr?.toString() || "Execution failed",
      status: execError.status || 1,
    };
  }
}

/**
 * Tests for container execution functionality
 */
describe("Container Execute Commands", function () {
  this.timeout(30000); // Docker operations can be slow

  let testDir: string;
  let projectPath: string;
  let originalHomeDir: unknown;
  let toolRegistration: TestToolRegistration;
  let containerName: string;
  const projectName = "test-project";

  beforeEach(async function () {
    // Skip tests if Docker is not available
    if (!isDockerAvailable()) {
      this.skip();
      return;
    }

    // Set up test environment
    testDir = createTestEnvironment();
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);

    // Create project directory and test files
    projectPath = path.join(testDir, "test-project");
    fs.mkdirSync(projectPath, { recursive: true });
    fs.writeFileSync(
      path.join(projectPath, "test.txt"),
      "Hello from container!"
    );

    // Create unique container name for this test run
    containerName = `codebox-test-container-${Date.now()}`;

    // Start a container that will stay running
    try {
      execSync(
        `docker run -d --name ${containerName} -v "${projectPath}:${projectPath}" alpine:latest sleep 3600`
      );

      // Verify container is running
      const containerCheck = execSync(`docker ps -q -f "name=${containerName}"`)
        .toString()
        .trim();
      if (!containerCheck) {
        throw new Error("Container not running after start command");
      }
    } catch (error) {
      console.error(`Failed to start test container: ${error}`);
      this.skip();
      return;
    }

    // Register project in system config with container name - updated to new format
    createTestConfig(testDir, {
      projects: [
        {
          name: projectName,
          hostPath: projectPath,
          containerName: containerName,
        },
      ],
    });

    // Set up test tool registration
    toolRegistration = new TestToolRegistration();

    // Get the server object to register tools
    const server = toolRegistration.getServer();

    // Register execute_command tool with container support
    server.tool(
      "execute_command",
      "Execute a command in a running container",
      {},
      async (params: unknown) => {
        const { projectName, command } = params as {
          projectName: string;
          command: string;
        };

        // In our test, we're only supporting one project
        if (projectName !== "test-project") {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Invalid or unregistered project: ${projectName}`,
              },
            ],
          };
        }

        // Execute the command in the container
        try {
          const { stdout, stderr, status } = await executeInContainer(
            containerName,
            command
          );

          // Format the output
          let output = stdout;
          if (stderr) {
            output += "\n\nSTDERR:\n" + stderr;
          }

          return {
            isError: status !== 0,
            content: [{ type: "text", text: output }],
            _meta: {
              status,
            },
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error executing command: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`,
              },
            ],
          };
        }
      }
    );

    // Register execute_batch_commands tool with container support
    server.tool(
      "execute_batch_commands",
      "Execute multiple commands in a running container",
      {},
      async (params: unknown) => {
        const {
          projectName,
          commands,
          stopOnError = true,
        } = params as {
          projectName: string;
          commands: string[];
          stopOnError?: boolean;
        };

        // In our test, we're only supporting one project
        if (projectName !== "test-project") {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Invalid or unregistered project: ${projectName}`,
              },
            ],
          };
        }

        const results = [];
        let hasError = false;

        // Execute each command in sequence
        for (const command of commands) {
          try {
            const { stdout, stderr, status } = await executeInContainer(
              containerName,
              command
            );

            // Format output for this command
            let output = stdout;
            if (stderr) {
              output += "\n\nSTDERR:\n" + stderr;
            }

            // Add to results
            results.push({
              command,
              output,
              status,
              success: status === 0,
            });

            // Check for error
            if (status !== 0) {
              hasError = true;
              if (stopOnError) {
                break;
              }
            }
          } catch (error) {
            hasError = true;
            results.push({
              command,
              output: error instanceof Error ? error.message : String(error),
              status: 1,
              success: false,
            });

            if (stopOnError) {
              break;
            }
          }
        }

        // Format the results
        const formattedResults = results
          .map((result) => {
            return (
              `Command: ${result.command}\n` +
              `Status: ${result.success ? "Success" : "Failed"}\n` +
              `Output:\n${result.output}\n` +
              "----------------------------------------\n"
            );
          })
          .join("\n");

        return {
          isError: hasError && stopOnError,
          content: [
            {
              type: "text",
              text: formattedResults,
            },
          ],
        };
      }
    );
  });

  afterEach(function () {
    // Restore original home directory
    if (originalHomeDir) {
      _setHomeDir(originalHomeDir as () => string);
    }

    // Stop and remove the test container
    try {
      if (containerName) {
        execSync(`docker rm -f ${containerName}`);
      }
    } catch (error) {
      console.error(`Error cleaning up container: ${error}`);
    }

    // Clean up test environment
    if (testDir) {
      cleanupTestEnvironment(testDir);
    }
  });

  it("should execute a simple command in the container", async function () {
    // Execute a simple command to read the test file
    const response = (await toolRegistration.callTool("execute_command", {
      projectName: projectName,
      command: `cat ${path.join(projectPath, "test.txt")}`,
    })) as {
      isError: boolean;
      content: { text: string }[];
      _meta?: { status: number };
    };

    // Verify the command executed successfully
    expect(response.isError).to.equal(false);
    expect(response.content[0].text).to.include("Hello from container!");
    expect(response._meta?.status).to.equal(0);
  });

  it("should handle command errors in the container", async function () {
    // Execute a command that should fail
    const response = (await toolRegistration.callTool("execute_command", {
      projectName: projectName,
      command: "cat /nonexistent/file.txt",
    })) as {
      isError: boolean;
      content: { text: string }[];
      _meta?: { status: number };
    };

    // Verify the command returned an error
    expect(response.isError).to.equal(true);
    expect(response.content[0].text).to.include("No such file or directory");
    expect(response._meta?.status).to.not.equal(0);
  });

  it("should execute batch commands in the container", async function () {
    // Execute multiple commands in sequence
    const response = (await toolRegistration.callTool(
      "execute_batch_commands",
      {
        projectName: projectName,
        commands: [
          "echo 'First command'",
          `echo 'Second command' > ${path.join(projectPath, "output.txt")}`,
          `cat ${path.join(projectPath, "output.txt")}`,
        ],
      }
    )) as { isError: boolean; content: { text: string }[] };

    // Verify all commands executed successfully
    expect(response.isError).to.equal(false);
    expect(response.content[0].text).to.include("First command");
    expect(response.content[0].text).to.include("Second command");

    // Verify file was created in the project directory
    const outputFile = path.join(projectPath, "output.txt");
    expect(fs.existsSync(outputFile)).to.equal(true);
    expect(fs.readFileSync(outputFile, "utf8")).to.include("Second command");
  });

  it("should stop batch execution on error when stopOnError is true", async function () {
    // Execute commands with an error in the middle
    const response = (await toolRegistration.callTool(
      "execute_batch_commands",
      {
        projectName: projectName,
        commands: [
          "echo 'First command'",
          "cat /nonexistent/file.txt", // This should fail
          "echo 'Should not execute'",
        ],
        stopOnError: true,
      }
    )) as { isError: boolean; content: { text: string }[] };

    // Verify execution stopped after the error
    expect(response.isError).to.equal(true);
    expect(response.content[0].text).to.include("First command");
    expect(response.content[0].text).to.include("No such file or directory");
    expect(response.content[0].text).to.not.include("Should not execute");
  });

  it("should continue batch execution after error when stopOnError is false", async function () {
    // Execute commands with an error but continue execution
    const response = (await toolRegistration.callTool(
      "execute_batch_commands",
      {
        projectName: projectName,
        commands: [
          "echo 'First command'",
          "cat /nonexistent/file.txt", // This should fail
          "echo 'Should still execute'",
        ],
        stopOnError: false,
      }
    )) as { isError: boolean; content: { text: string }[] };

    // Verify all commands were attempted despite the error
    expect(response.content[0].text).to.include("First command");
    expect(response.content[0].text).to.include("No such file or directory");
    expect(response.content[0].text).to.include("Should still execute");
  });

  it("should share environment variables between commands in a batch", async function () {
    // Execute commands that set and use an environment variable
    const response = (await toolRegistration.callTool(
      "execute_batch_commands",
      {
        projectName: projectName,
        commands: ["export TEST_VAR='container test value'", "echo $TEST_VAR"],
      }
    )) as { isError: boolean; content: { text: string }[] };

    // Verify the environment variable was shared between commands
    expect(response.isError).to.equal(false);
    expect(response.content[0].text).to.include("container test value");
  });

  it("should return error for invalid project name", async function () {
    // Execute a command with an invalid project name
    const response = (await toolRegistration.callTool("execute_command", {
      projectName: "non-existent-project",
      command: "echo 'This should fail'",
    })) as {
      isError: boolean;
      content: { text: string }[];
    };

    // Verify the error response
    expect(response.isError).to.equal(true);
    expect(response.content[0].text).to.include(
      "Invalid or unregistered project"
    );
  });
});
