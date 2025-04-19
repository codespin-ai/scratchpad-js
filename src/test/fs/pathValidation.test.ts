import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  validateDirectory,
  validateFilePath,
  ensureDirectoryForFile,
} from "../../fs/pathValidation.js";
import {
  createTestEnvironment,
  cleanupTestEnvironment,
} from "../utils/setup.js";

describe("Path Validation", () => {
  let testDir: string;

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();
  });

  afterEach(() => {
    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("validateDirectory", () => {
    it("should not throw for valid directories", () => {
      // Create a test directory
      const validDir = path.join(testDir, "valid-dir");
      fs.mkdirSync(validDir, { recursive: true });

      // Should not throw
      expect(() => validateDirectory(validDir)).to.not.throw();
    });

    it("should throw if directory doesn't exist", () => {
      const nonExistentDir = path.join(testDir, "non-existent");

      // Should throw with specific message
      expect(() => validateDirectory(nonExistentDir)).to.throw(
        "Directory not found"
      );
    });

    it("should throw if path is not a directory", () => {
      // Create a file
      const filePath = path.join(testDir, "test-file.txt");
      fs.writeFileSync(filePath, "test content");

      // Should throw with specific message
      expect(() => validateDirectory(filePath)).to.throw(
        "Path is not a directory"
      );
    });
  });

  describe("validateFilePath", () => {
    it("should return true for files inside project directory", () => {
      const projectDir = path.join(testDir, "project");
      fs.mkdirSync(projectDir, { recursive: true });

      // Valid paths
      expect(validateFilePath(projectDir, "file.txt")).to.be.true;
      expect(validateFilePath(projectDir, "dir/file.txt")).to.be.true;
      expect(validateFilePath(projectDir, "./file.txt")).to.be.true;
      expect(validateFilePath(projectDir, "./dir/../file.txt")).to.be.true;
    });

    it("should return false for paths outside project directory", () => {
      const projectDir = path.join(testDir, "project");
      fs.mkdirSync(projectDir, { recursive: true });

      // Invalid paths - these should try to access outside the project dir
      expect(validateFilePath(projectDir, "../file.txt")).to.be.false;
      expect(validateFilePath(projectDir, "/etc/passwd")).to.be.false;
      expect(validateFilePath(projectDir, "../../file.txt")).to.be.false;
      expect(validateFilePath(projectDir, "dir/../../file.txt")).to.be.false;
    });
  });

  describe("ensureDirectoryForFile", () => {
    it("should create directory if it doesn't exist", () => {
      const nestedDir = path.join(testDir, "nested/dir/structure");
      const filePath = path.join(nestedDir, "file.txt");

      // Directory shouldn't exist yet
      expect(fs.existsSync(nestedDir)).to.be.false;

      // Create directory for file
      ensureDirectoryForFile(filePath);

      // Directory should now exist
      expect(fs.existsSync(nestedDir)).to.be.true;
    });

    it("should do nothing if directory already exists", () => {
      const existingDir = path.join(testDir, "existing-dir");
      fs.mkdirSync(existingDir, { recursive: true });

      const filePath = path.join(existingDir, "file.txt");

      // Should not throw
      expect(() => ensureDirectoryForFile(filePath)).to.not.throw();

      // Directory should still exist
      expect(fs.existsSync(existingDir)).to.be.true;
    });
  });
});
