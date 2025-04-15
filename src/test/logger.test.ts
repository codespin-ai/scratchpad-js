import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { isDebugEnabled, logMcpCall, _setHomeDir } from "../utils/logger.js";
import { createTestEnvironment, cleanupTestEnvironment, createTestConfig } from "./setup.js";

describe("Logger Utility", () => {
  let testDir: string;
  let originalHomeDir: any;

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
    _setHomeDir(originalHomeDir);
    
    // Clean up test environment
    cleanupTestEnvironment(testDir);
  });

  describe("isDebugEnabled", () => {
    it("should return false when no config file exists", () => {
      expect(isDebugEnabled()).to.be.false;
    });

    it("should return false when debug is not set in config", () => {
      createTestConfig(testDir, { dockerImage: "node:18" });
      expect(isDebugEnabled()).to.be.false;
    });

    it("should return false when debug is explicitly set to false", () => {
      createTestConfig(testDir, { dockerImage: "node:18", debug: false });
      expect(isDebugEnabled()).to.be.false;
    });

    it("should return true when debug is explicitly set to true", () => {
      createTestConfig(testDir, { dockerImage: "node:18", debug: true });
      expect(isDebugEnabled()).to.be.true;
    });
  });

  describe("logMcpCall", () => {
    it("should not create log files when debug is disabled", () => {
      createTestConfig(testDir, { dockerImage: "node:18", debug: false });
      
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
      createTestConfig(testDir, { dockerImage: "node:18", debug: true });
      
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
      const datePart = new Date().toISOString().split('T')[0].replace(/-/g, '-');
      const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
      expect(logFiles.length).to.be.at.least(1);
      
      // Check request files
      const requestFiles = fs.readdirSync(requestsDir);
      expect(requestFiles.length).to.equal(2); // One for payload, one for response
    });

    it("should log error responses correctly", () => {
      createTestConfig(testDir, { dockerImage: "node:18", debug: true });
      
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
      
      const responseContent = fs.readFileSync(path.join(requestsDir, responseFile!), 'utf8');
      const parsedResponse = JSON.parse(responseContent);
      
      expect(parsedResponse).to.have.property('error');
      expect(parsedResponse.error).to.equal('Something went wrong');
    });
  });
});