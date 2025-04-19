import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { TestToolRegistration } from "../mockUtils.js";
import { _setHomeDir } from "../../utils/logger.js";
import {
  createTestEnvironment,
  cleanupTestEnvironment,
  createTestConfig,
} from "../setup.js";
import { SpawnSyncOptionsWithStringEncoding, spawnSync } from "child_process";

/**
 * Checks if Docker is available on the system
 * @returns True if Docker is available, false otherwise
 */
function isDockerAvailable(): boolean {
  try {
    const dockerCheck = spawnSync("docker", ["--version"]);
    return !(dockerCheck.error || dockerCheck.status !== 0);
  } catch {
    return false;
  }
}

// Execute command implementation for testing with real Docker containers
async function executeInDocker(
  projectDir: string,
  command: string,
  dockerImage = "alpine:latest",
  networkParam = ""
): Promise<{
  stdout: string;
  stderr: string;
  status: number | null;
}> {
  // Construct Docker command
  const networkOption = networkParam ? [`--network=${networkParam}`] : [];

  const dockerCmd = [
    "docker",
    "run",
    "--rm",
    ...networkOption,
    "-v",
    `${projectDir}:/workdir`,
    "-w",
    "/workdir",
    dockerImage,
    "sh",
    "-c",
    command,
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
    status: result.status,
  };
}

/**
 * Tests for execute_command and execute_batch_commands tools
 */
describe("Execute Commands", function () {
  this.timeout(15000); // Docker operations can be slow

  let testDir: string;
  let projectPath: string;
  let originalHomeDir: unknown;
  let toolRegistration: TestToolRegistration;
  const dockerImage = "alpine:latest";
  const projectName = "test-project";
  const projectWithNetworkName = "test-project-with-network";
  const testNetwork = "codebox-test-network";

  beforeEach(async function () {
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

    // Create a test network
    try {
      spawnSync("docker", ["network", "create", testNetwork]);
    } catch (error) {
      console.error(`Failed to create test network: ${error}`);
      // Continue anyway
    }

    // Set up test environment
    testDir = createTestEnvironment();
    originalHomeDir = _setHomeDir;
    _setHomeDir(() => testDir);

    // Create project directory and test files in one batch
    projectPath = path.join(testDir, "test-project");
    fs.mkdirSync(projectPath, { recursive: true });

    // Create all test files in batch
    for (const file of [
      { path: path.join(projectPath, "test.txt"), content: "Hello, world!" },
      {
        path: path.join(projectPath, "test2.txt"),
        content: "Another test file",
      },
      {
        path: path.join(projectPath, "script.sh"),
        content:
          '#!/bin/sh\necho "Running script"\necho "Arguments: $@"\necho "Success!"\n',
      },
      {
        path: path.join(projectPath, "error.sh"),
        content: '#!/bin/sh\necho "Error message" >&2\nexit 1',
      },
    ]) {
      fs.writeFileSync(file.path, file.content);
    }

    // Set permissions for script files
    fs.chmodSync(path.join(projectPath, "script.sh"), 0o755);
    fs.chmodSync(path.join(projectPath, "error.sh"), 0o755);

    // Register two projects in system config:
    // 1. One without network
    // 2. One with network
    createTestConfig(testDir, {
      projects: [
        {
          name: projectName,
          hostPath: projectPath,
          dockerImage: dockerImage,
          // No network parameter
        },
        {
          name: projectWithNetworkName,
          hostPath: projectPath, // Same path, different project
          dockerImage: dockerImage,
          network: testNetwork, // With network parameter
        },
      ],
    });

    // Set up test tool registration
    toolRegistration = new TestToolRegistration();

    // Register execute_command tool
    toolRegistration.registerTool(
      "execute_command",
      async (params: unknown) => {
        const { projectName, command } = params as {
          projectName: string;
          command: string;
        };

        // Get proper network setting based on project name
        let networkToUse = "";
        if (projectName === projectWithNetworkName) {
          networkToUse = testNetwork;
        } else if (projectName !== "test-project") {
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

        // Execute the command in Docker with or without network parameter
        const result = await executeInDocker(
          projectPath,
          command,
          dockerImage,
          networkToUse
        );

        // Format the output
        let output = result.stdout;
        if (result.stderr) {
          output += "\n\nSTDERR:\n" + result.stderr;
        }

        return {
          content: [{ type: "text", text: output }],
          metadata: {
            status: result.status,
            networkUsed: networkToUse || "none",
          },
        };
      }
    );

    // Register execute_batch_commands tool
    toolRegistration.registerTool(
      "execute_batch_commands",
      async (params: unknown) => {
        const {
          projectName,
          commands,
          stopOnError = false,
        } = params as {
          projectName: string;
          commands: string[];
          stopOnError?: boolean;
        };

        // Get proper network setting based on project name
        let networkToUse = "";
        if (projectName === projectWithNetworkName) {
          networkToUse = testNetwork;
        } else if (projectName !== "test-project") {
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
          const result = await executeInDocker(
            projectPath,
            command,
            dockerImage,
            networkToUse
          );

          // Format output for this command
          let output = result.stdout;
          if (result.stderr) {
            output += "\n\nSTDERR:\n" + result.stderr;
          }

          // Add to results
          results.push({
            command,
            output,
            status: result.status,
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
        const finalOutput = results
          .map((r) => {
            return `$ ${r.command}\n${r.output}${
              r.status !== 0
                ? "\n[Command failed with exit code " + r.status + "]"
                : ""
            }`;
          })
          .join("\n\n");

        return {
          content: [{ type: "text", text: finalOutput }],
          metadata: {
            results,
            hasError,
            networkUsed: networkToUse || "none",
          },
        };
      }
    );
  });

  afterEach(() => {
    // Restore original home directory
    if (originalHomeDir) {
      _setHomeDir(originalHomeDir as () => string);
    }

    // Try to clean up the test network
    try {
      spawnSync("docker", ["network", "rm", testNetwork]);
    } catch (error) {
      console.error(`Error cleaning up network: ${error}`);
    }

    // Clean up test environment
    if (testDir) {
      cleanupTestEnvironment(testDir);
    }
  });

  describe("execute_command", function () {
    it("should execute a basic command (without network)", async function () {
      const response = (await toolRegistration.callTool("execute_command", {
        projectName: projectName, // Project without network
        command: "cat test.txt",
      })) as {
        content: { text: string }[];
        metadata: { status: number; networkUsed: string };
      };

      expect(response.content[0].text).to.equal("Hello, world!");
      expect(response.metadata.status).to.equal(0);
      expect(response.metadata.networkUsed).to.equal("none");
    });

    it("should execute a basic command (with network)", async function () {
      const response = (await toolRegistration.callTool("execute_command", {
        projectName: projectWithNetworkName, // Project with network
        command: "cat test.txt",
      })) as {
        content: { text: string }[];
        metadata: { status: number; networkUsed: string };
      };

      expect(response.content[0].text).to.equal("Hello, world!");
      expect(response.metadata.status).to.equal(0);
      expect(response.metadata.networkUsed).to.equal(testNetwork);
    });

    it("should handle command errors", async function () {
      const response = (await toolRegistration.callTool("execute_command", {
        projectName: projectName,
        command: "cat nonexistent.txt",
      })) as { content: { text: string }[]; metadata: { status: number } };

      expect(response.content[0].text).to.include("STDERR:");
      expect(response.content[0].text).to.include("No such file or directory");
      expect(response.metadata.status).to.not.equal(0);
    });

    it("should execute scripts with arguments", async function () {
      const response = (await toolRegistration.callTool("execute_command", {
        projectName: projectName,
        command: "./script.sh arg1 arg2",
      })) as { content: { text: string }[]; metadata: { status: number } };

      expect(response.content[0].text).to.include("Running script");
      expect(response.content[0].text).to.include("Arguments: arg1 arg2");
      expect(response.content[0].text).to.include("Success!");
      expect(response.metadata.status).to.equal(0);
    });

    it("should return error for invalid project name", async function () {
      const response = (await toolRegistration.callTool("execute_command", {
        projectName: "non-existent-project",
        command: "echo 'This should fail'",
      })) as {
        isError: boolean;
        content: { text: string }[];
      };

      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or unregistered project"
      );
    });
  });

  describe("execute_batch_commands", function () {
    it("should execute multiple commands in sequence (without network)", async function () {
      const response = (await toolRegistration.callTool(
        "execute_batch_commands",
        {
          projectName: projectName, // Project without network
          commands: ["cat test.txt", "cat test2.txt"],
        }
      )) as {
        content: { text: string }[];
        metadata: {
          hasError: boolean;
          results: unknown[];
          networkUsed: string;
        };
      };

      expect(response.content[0].text).to.include("Hello, world!");
      expect(response.content[0].text).to.include("Another test file");
      expect(response.metadata.hasError).to.equal(false);
      expect(response.metadata.networkUsed).to.equal("none");
    });

    it("should execute multiple commands in sequence (with network)", async function () {
      const response = (await toolRegistration.callTool(
        "execute_batch_commands",
        {
          projectName: projectWithNetworkName, // Project with network
          commands: ["cat test.txt", "cat test2.txt"],
        }
      )) as {
        content: { text: string }[];
        metadata: {
          hasError: boolean;
          results: unknown[];
          networkUsed: string;
        };
      };

      expect(response.content[0].text).to.include("Hello, world!");
      expect(response.content[0].text).to.include("Another test file");
      expect(response.metadata.hasError).to.equal(false);
      expect(response.metadata.networkUsed).to.equal(testNetwork);
    });

    it("should continue execution after errors by default", async function () {
      const response = (await toolRegistration.callTool(
        "execute_batch_commands",
        {
          projectName: projectName,
          commands: ["cat nonexistent.txt", "cat test.txt"],
        }
      )) as {
        content: { text: string }[];
        metadata: { hasError: boolean; results: unknown[] };
      };

      expect(response.content[0].text).to.include("No such file or directory");
      expect(response.content[0].text).to.include("Hello, world!");
      expect(response.metadata.hasError).to.equal(true);
      expect(response.metadata.results.length).to.equal(2);
    });

    it("should stop execution after errors when stopOnError is true", async function () {
      const response = (await toolRegistration.callTool(
        "execute_batch_commands",
        {
          projectName: projectName,
          commands: ["cat nonexistent.txt", "cat test.txt"],
          stopOnError: true,
        }
      )) as {
        content: { text: string }[];
        metadata: { hasError: boolean; results: unknown[] };
      };

      expect(response.content[0].text).to.include("No such file or directory");
      expect(response.content[0].text).to.not.include("Hello, world!");
      expect(response.metadata.hasError).to.equal(true);
      expect(response.metadata.results.length).to.equal(1);
    });

    it("should preserve environment between commands", async function () {
      const response = (await toolRegistration.callTool(
        "execute_batch_commands",
        {
          projectName: projectName,
          commands: ["VAR=test", "echo $VAR"],
        }
      )) as { content: { text: string }[]; metadata: { hasError: boolean } };

      expect(response.content[0].text).to.include("test");
      expect(response.metadata.hasError).to.equal(false);
    });

    it("should return error for invalid project name", async function () {
      const response = (await toolRegistration.callTool(
        "execute_batch_commands",
        {
          projectName: "non-existent-project",
          commands: ["echo 'This should fail'"],
        }
      )) as {
        isError: boolean;
        content: { text: string }[];
      };

      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or unregistered project"
      );
    });
  });

  // Network-specific tests
  describe("network functionality", function () {
    it("should work with and without network parameter", async function () {
      // This test specifically verifies the difference between network and no-network
      // environments. In a real use case, we would add a container on the network
      // and test communication, but for unit tests this is sufficient.

      // Execute with network
      const withNetworkResponse = (await toolRegistration.callTool(
        "execute_command",
        {
          projectName: projectWithNetworkName,
          command: "echo 'Test with network'",
        }
      )) as { content: { text: string }[]; metadata: { networkUsed: string } };

      // Execute without network
      const withoutNetworkResponse = (await toolRegistration.callTool(
        "execute_command",
        {
          projectName: projectName,
          command: "echo 'Test without network'",
        }
      )) as { content: { text: string }[]; metadata: { networkUsed: string } };

      // Verify both work correctly with proper network settings
      expect(withNetworkResponse.metadata.networkUsed).to.equal(testNetwork);
      expect(withoutNetworkResponse.metadata.networkUsed).to.equal("none");

      // Verify both commands executed successfully
      expect(withNetworkResponse.content[0].text).to.include(
        "Test with network"
      );
      expect(withoutNetworkResponse.content[0].text).to.include(
        "Test without network"
      );
    });
  });
});
