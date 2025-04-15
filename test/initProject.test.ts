import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";
import { initWithCustomHome, setMockGitRoot } from "./initWrapper.js";

describe("Init Command - Project Level", function() {
  this.timeout(10000); // Git operations might take time
  
  let testDir: string;
  
  beforeEach(function() {
    // Create a unique test directory for this test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebox-test-'));
    
    // Reset mock git root
    setMockGitRoot(null);
  });
  
  afterEach(function() {
    // Clean up test directory
    if (testDir) {
      rimrafSync(testDir);
    }
  });
  
  it("should create project-level configuration", async function() {
    // Create and initialize Git repository
    const projectDir = path.join(testDir, "project-create");
    fs.mkdirSync(projectDir, { recursive: true });
    // Mock a Git repo rather than creating a real one
    setMockGitRoot(projectDir);
    
    // Call the init function
    await initWithCustomHome(
      { image: "node:18" },
      { workingDir: projectDir },
      testDir
    );
    
    // Verify config file was created
    const configFile = path.join(projectDir, ".codespin", "codebox.json");
    expect(fs.existsSync(configFile)).to.be.true;
    
    // Verify config contents
    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    expect(config).to.have.property("dockerImage", "node:18");
  });
  
  it("should fail if config exists and force is not set", async function() {
    // Create project directory
    const projectDir = path.join(testDir, "project-fail");
    fs.mkdirSync(projectDir, { recursive: true });
    setMockGitRoot(projectDir);
    
    // Create initial config
    const configDir = path.join(projectDir, ".codespin");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, "codebox.json"),
      JSON.stringify({ dockerImage: "existing:image" }, null, 2)
    );
    
    let errorThrown = false;
    
    // Call init without force flag should throw
    try {
      await initWithCustomHome(
        { image: "node:18" },
        { workingDir: projectDir },
        testDir
      );
    } catch (err) {
      errorThrown = true;
      expect((err as Error).message).to.include("Configuration already exists");
    }
    
    // Ensure error was thrown
    expect(errorThrown).to.be.true;
    
    // Verify original config was not changed
    const configFile = path.join(configDir, "codebox.json");
    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    expect(config).to.have.property("dockerImage", "existing:image");
  });
  
  it("should overwrite existing config when force is set", async function() {
    // Create project directory
    const projectDir = path.join(testDir, "project-force");
    fs.mkdirSync(projectDir, { recursive: true });
    setMockGitRoot(projectDir);
    
    // Create initial config
    const configDir = path.join(projectDir, ".codespin");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, "codebox.json"),
      JSON.stringify({ dockerImage: "existing:image" }, null, 2)
    );
    
    // Call init with force flag
    await initWithCustomHome(
      { image: "node:18", force: true },
      { workingDir: projectDir },
      testDir
    );
    
    // Verify config was updated
    const configFile = path.join(configDir, "codebox.json");
    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    expect(config.dockerImage).to.equal("node:18");
  });
  
  it("should respect debug flag when set", async function() {
    // Create project directory
    const projectDir = path.join(testDir, "project-debug");
    fs.mkdirSync(projectDir, { recursive: true });
    setMockGitRoot(projectDir);
    
    // Call init with debug flag
    await initWithCustomHome(
      { image: "node:18", debug: true },
      { workingDir: projectDir },
      testDir
    );
    
    // Verify config includes debug flag
    const configFile = path.join(projectDir, ".codespin", "codebox.json");
    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    expect(config).to.have.property("dockerImage", "node:18");
    expect(config).to.have.property("debug", true);
  });
  
  it("should fail if not in a git repository", async function() {
    // Use a directory that's not a git repo
    const nonGitDir = path.join(testDir, "non-git-dir");
    fs.mkdirSync(nonGitDir, { recursive: true });
    
    // Mock git root to return undefined (not a git repo)
    setMockGitRoot(undefined);
    
    let errorThrown = false;
    let errorMessage = "";
    
    // Call init should throw
    try {
      await initWithCustomHome(
        { image: "node:18" },
        { workingDir: nonGitDir },
        testDir
      );
    } catch (err) {
      errorThrown = true;
      errorMessage = (err as Error).message;
    }
    
    // Ensure error was thrown with correct message
    expect(errorThrown).to.be.true;
    expect(errorMessage).to.include("Not in a git repository");
    
    // Verify no config was created
    const configFile = path.join(nonGitDir, ".codespin", "codebox.json");
    expect(fs.existsSync(configFile)).to.be.false;
  });
  
  // Helper to recursively remove a directory (like rm -rf)
  function rimrafSync(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach((entry) => {
        const entryPath = path.join(dirPath, entry);
        if (fs.lstatSync(entryPath).isDirectory()) {
          rimrafSync(entryPath);
        } else {
          fs.unlinkSync(entryPath);
        }
      });
      fs.rmdirSync(dirPath);
    }
  }
});