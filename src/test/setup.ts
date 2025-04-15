import { install } from "source-map-support";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { setMockHomeDir, restoreMockHomeDir } from "./osWrapper.js";

// Install source map support for better error stack traces
install();

/**
 * Creates a temporary test directory structure for testing purposes.
 * 
 * @returns The path to the temporary test directory
 */
export function createTestEnvironment(): string {
  const tempDir = path.join(os.tmpdir(), `codebox-test-${Date.now()}`);
  
  // Create the main test directory
  fs.mkdirSync(tempDir, { recursive: true });
  
  // Create .codespin directory structure for testing
  const configDir = path.join(tempDir, ".codespin");
  fs.mkdirSync(configDir, { recursive: true });
  
  // Create logs directory for debug logging tests
  const logsDir = path.join(configDir, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  
  // Create requests directory for detailed log files
  const requestsDir = path.join(logsDir, "requests");
  fs.mkdirSync(requestsDir, { recursive: true });
  
  return tempDir;
}

/**
 * Cleans up the test environment by removing temporary directories.
 * 
 * @param tempDir - The temporary directory to clean up
 */
export function cleanupTestEnvironment(tempDir: string): void {
  if (fs.existsSync(tempDir)) {
    // Recursive function to remove directory contents
    const removeDir = (dirPath: string) => {
      if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
          const curPath = path.join(dirPath, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            // Recursive call for directories
            removeDir(curPath);
          } else {
            // Delete files
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(dirPath);
      }
    };
    
    removeDir(tempDir);
  }
}

/**
 * Creates a test configuration file for codebox
 * 
 * @param directory - Directory where to create the config file
 * @param config - Configuration object
 */
export function createTestConfig(directory: string, config: Record<string, unknown>): void {
  const configDir = path.join(directory, ".codespin");
  
  // Ensure the directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // Write the config file
  const configFile = path.join(configDir, "codebox.json");
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

/**
 * Mocks the home directory for testing
 * 
 * @param tempDir - Temporary directory to use as home
 * @returns A function to restore the original home directory
 */
export function mockHomeDir(tempDir: string): () => void {
  // Set mock home directory
  setMockHomeDir(tempDir);
  
  // Return a function to restore the original
  return restoreMockHomeDir;
}
