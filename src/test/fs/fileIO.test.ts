import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { writeProjectFile, readProjectFile, projectFileExists } from "../../fs/fileIO.js";
import { createTestEnvironment, cleanupTestEnvironment } from "../utils/setup.js";

describe("File I/O", () => {
  let testDir: string;
  let projectDir: string;

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();
    
    // Create a test project directory
    projectDir = path.join(testDir, "test-project");
    fs.mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("writeProjectFile", () => {
    it("should write content to a file", () => {
      const filePath = "test-file.txt";
      const content = "Hello, world!";
      
      writeProjectFile(projectDir, filePath, content);
      
      // Check if file exists with correct content
      const fullPath = path.join(projectDir, filePath);
      expect(fs.existsSync(fullPath)).to.be.true;
      expect(fs.readFileSync(fullPath, "utf8")).to.equal(content);
    });

    it("should create nested directories as needed", () => {
      const filePath = "nested/dir/test-file.txt";
      const content = "Nested file content";
      
      writeProjectFile(projectDir, filePath, content);
      
      // Check if directories and file were created
      const fullPath = path.join(projectDir, filePath);
      expect(fs.existsSync(fullPath)).to.be.true;
      expect(fs.readFileSync(fullPath, "utf8")).to.equal(content);
    });

    it("should append content to existing file when mode is append", () => {
      const filePath = "append-test.txt";
      const initialContent = "Initial content\n";
      const appendContent = "Appended content";
      
      // Create initial file
      writeProjectFile(projectDir, filePath, initialContent);
      
      // Append to file
      writeProjectFile(projectDir, filePath, appendContent, "append");
      
      // Check if content was appended
      const fullPath = path.join(projectDir, filePath);
      expect(fs.readFileSync(fullPath, "utf8")).to.equal(initialContent + appendContent);
    });

    it("should throw for paths outside project directory", () => {
      const invalidPath = "../outside-project.txt";
      
      // Should throw with specific message
      expect(() => writeProjectFile(projectDir, invalidPath, "test"))
        .to.throw("Invalid file path");
    });
  });

  describe("readProjectFile", () => {
    it("should read content from a file", () => {
      const filePath = "read-test.txt";
      const content = "File content to read";
      
      // Create file first
      const fullPath = path.join(projectDir, filePath);
      fs.writeFileSync(fullPath, content);
      
      // Read file
      const readContent = readProjectFile(projectDir, filePath);
      expect(readContent).to.equal(content);
    });

    it("should throw if file doesn't exist", () => {
      const nonExistentFile = "non-existent.txt";
      
      // Should throw with specific message
      expect(() => readProjectFile(projectDir, nonExistentFile))
        .to.throw("File not found");
    });

    it("should throw for paths outside project directory", () => {
      const invalidPath = "../outside-project.txt";
      
      // Should throw with specific message
      expect(() => readProjectFile(projectDir, invalidPath))
        .to.throw("Invalid file path");
    });
  });

  describe("projectFileExists", () => {
    it("should return true for existing files", () => {
      const filePath = "exists-test.txt";
      
      // Create file
      const fullPath = path.join(projectDir, filePath);
      fs.writeFileSync(fullPath, "test content");
      
      // Check if file exists
      expect(projectFileExists(projectDir, filePath)).to.be.true;
    });

    it("should return false for non-existent files", () => {
      const nonExistentFile = "non-existent.txt";
      
      // Check if file exists
      expect(projectFileExists(projectDir, nonExistentFile)).to.be.false;
    });

    it("should return false for paths outside project directory", () => {
      const invalidPath = "../outside-project.txt";
      
      // Should return false for invalid paths
      expect(projectFileExists(projectDir, invalidPath)).to.be.false;
    });
  });
});