import * as os from "os";

// Original homedir function
const originalHomedir = os.homedir;

// Current mock home directory
let mockHome: string | null = null;

/**
 * Set a custom home directory for testing
 *
 * @param dir Directory to use as home
 */
export function setMockHomeDir(dir: string): void {
  mockHome = dir;
}

/**
 * Restore original home directory
 */
export function restoreMockHomeDir(): void {
  mockHome = null;
}

/**
 * Custom homedir function that returns the mock directory if set
 */
export function homedir(): string {
  return mockHome || originalHomedir();
}
