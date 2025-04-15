import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { isDebugEnabled, logMcpCall, _setHomeDir } from "../utils/logger.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "./setup.js";

describe("Logger Utility", () => {
  let testDir: string;
  let originalHomeDir: unknown;

  beforeEach(() => {
    // Set up test environment
    testDir = createTestEnvironment();
    
    // Save original function
    originalHomeDir = _setHomeDir;
    
    // Set mock home directory
    _setHomeDir(() => testDir);
  });

  afterEach(() => {
    // Restore original function
    _setHomeDir(originalHomeDir as () => string);
    
    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("isDebugEnabled", () => {
    it("should return false when no config file exists", () => {
      expect(isDebugEnabled()).to.be.false;
    });

    it("should return false when debug is not set in config", () => {
      createTestConfig(testDir, { projects: [] });
      expect(isDebugEnabled()).to.be.false;
    });

    it("should return false when debug is explicitly set to false", () => {
      createTestConfig(testDir, { projects: [], debug: false });
      expect(isDebugEnabled()).to.be.false;
    });

    it("should return true when debug is explicitly set to true", () => {
      createTestConfig(testDir, { projects: [], debug: true });
      expect(isDebugEnabled()).to.be.true;
    });
  });

  describe("logMcpCall", () => {
    it("should not create log files when debug is disabled", () => {
      createTestConfig(testDir, { projects: [], debug: false });
      
      logMcpCall({
        method: "test_method",
        payload: { test: "payload" },
        response: { result: "success" },
        startTime: new Date(),
        endTime: new Date()
      });
      
      const logsDir = path.join(testDir, ".codespin", "logs");
      const logFiles = fs.existsSync(logsDir) ? fs.readdirSync(logsDir).filter(f => f.endsWith('.log')) : [];
      expect(logFiles.length).to.equal(0);
    });

    it("should create log files when debug is enabled", () => {
      createTestConfig(testDir, { projects: [], debug: true });
      
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 100); // 100ms later
      
      logMcpCall({
        method: "test_method",
        payload: { test: "payload" },
        response: { result: "success" },
        startTime,
        endTime
      });
      
      const logsDir = path.join(testDir, ".codespin", "logs");
      const requestsDir = path.join(logsDir, "requests");
      
      // Check main log file
      const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
      expect(logFiles.length).to.be.at.least(1);
      
      // Check request files
      const requestFiles = fs.readdirSync(requestsDir);
      expect(requestFiles.length).to.equal(2); // One for payload, one for response
    });

    it("should log error responses correctly", () => {
      createTestConfig(testDir, { projects: [], debug: true });
      
      logMcpCall({
        method: "test_method",
        payload: { test: "payload" },
        response: { error: "Something went wrong" },
        startTime: new Date(),
        endTime: new Date()
      });
      
      const logsDir = path.join(testDir, ".codespin", "logs");
      const requestsDir = path.join(logsDir, "requests");
      
      const requestFiles = fs.readdirSync(requestsDir);
      const responseFile = requestFiles.find(file => file.includes('_response.json'));
      
      if (!responseFile) {
        throw new Error("Response file not found");
      }
      
      const responseContent = fs.readFileSync(path.join(requestsDir, responseFile), 'utf8');
      const parsedResponse = JSON.parse(responseContent);
      
      expect(parsedResponse).to.have.property('error');
      expect(parsedResponse.error).to.equal('Something went wrong');
    });
  });
});
