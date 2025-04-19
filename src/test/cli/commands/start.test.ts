import { expect } from "chai";
import { start } from "../../../cli/commands/start.js";
import {
  createTestEnvironment,
  cleanupTestEnvironment,
} from "../../utils/setup.js";

describe("Start Command", () => {
  let testDir: string;

  beforeEach(() => {
    // Create temporary test directory
    testDir = createTestEnvironment();
  });

  afterEach(() => {
    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  it("should execute without errors", async () => {
    // Use the proper temporary directory as working dir
    const context = { workingDir: testDir };

    try {
      // We'll start but immediately terminate to prevent the actual server from running
      const startPromise = start(context);

      // This is a bit of a hack, but it allows us to "test" the function without
      // actually running the server or adding sinon as a dependency
      const timeout = new Promise((resolve) => setTimeout(resolve, 50));
      await Promise.race([startPromise, timeout]);

      // If we get here without errors, the test passes
      expect(true).to.be.true;
    } catch (error) {
      // If an error occurs, fail the test
      expect.fail(`Start command threw an error: ${error}`);
    }
  });
});
