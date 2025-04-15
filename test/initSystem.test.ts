import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { initWithCustomHome } from "./initWrapper.js";

describe("Init Command - System Level", function() {
  this.timeout(10000); // Git operations might take time
  
  let testDir: string;
  let projectDir: string;
  
  beforeEach(function() {
    // Create a unique test directory for this test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebox-test-'));
    
    // Create a basic working directory
    projectDir = path.join(testDir, "workdir");
    fs.mkdirSync(projectDir, { recursive: true });
  });
  
  afterEach(function() {
    // Clean up test directory
    if (testDir) {
      rimrafSync(testDir);
    }
  });
  
  it("should create system-level configuration", async function() {
    // Call init with system flag
    await initWithCustomHome(
      { image: "node:18", system: true },
      { workingDir: projectDir },
      testDir
    );
    
    // Verify config file was created in our mock home directory
    const configFile = path.join(testDir, ".codespin", "codebox.json");
    expect(fs.existsSync(configFile)).to.be.true;
    
    // Verify config contents
    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    expect(config).to.have.property("dockerImage", "node:18");
    expect(config).to.have.property("projects").that.is.an("array");
  });
  
  it("should fail if config exists and force is not set", async function() {
    // Create initial config
    const configDir = path.join(testDir, ".codespin");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, "codebox.json"),
      JSON.stringify({ 
        dockerImage: "existing:image",
        projects: []
      }, null, 2)
    );
    
    let errorThrown = false;
    
    // Call init without force flag should throw
    try {
      await initWithCustomHome(
        { image: "node:18", system: true },
        { workingDir: projectDir },
        testDir
      );
    } catch (err) {
      errorThrown = true;
      expect((err as Error).message).to.include("System configuration already exists");
    }
    
    // Ensure error was thrown
    expect(errorThrown).to.be.true;
    
    // Verify original config was not changed
    const configFile = path.join(configDir, "codebox.json");
    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    expect(config).to.have.property("dockerImage", "existing:image");
  });
  
  it("should overwrite existing config when force is set", async function() {
    // Create initial config
    const configDir = path.join(testDir, ".codespin");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, "codebox.json"),
      JSON.stringify({ 
        dockerImage: "existing:image",
        projects: []
      }, null, 2)
    );
    
    // Call init with force flag
    await initWithCustomHome(
      { image: "node:18", system: true, force: true },
      { workingDir: projectDir },
      testDir
    );
    
    // Verify config was updated
    const configFile = path.join(configDir, "codebox.json");
    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    expect(config.dockerImage).to.equal("node:18");
  });
  
  it("should preserve existing projects in system config", async function() {
    // Create initial config with projects
    const configDir = path.join(testDir, ".codespin");
    fs.mkdirSync(configDir, { recursive: true });
    const existingProjects = ["/path/to/project1", "/path/to/project2"];
    fs.writeFileSync(
      path.join(configDir, "codebox.json"),
      JSON.stringify({ 
        dockerImage: "existing:image",
        projects: existingProjects
      }, null, 2)
    );
    
    // Call init with force flag
    await initWithCustomHome(
      { image: "node:18", system: true, force: true },
      { workingDir: projectDir },
      testDir
    );
    
    // Verify projects array was preserved
    const configFile = path.join(configDir, "codebox.json");
    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    expect(config.dockerImage).to.equal("node:18");
    expect(config.projects).to.deep.equal(existingProjects);
  });
  
  it("should respect debug flag in system config", async function() {
    // Call init with system and debug flags
    await initWithCustomHome(
      { image: "node:18", system: true, debug: true },
      { workingDir: projectDir },
      testDir
    );
    
    // Verify config includes debug flag
    const configFile = path.join(testDir, ".codespin", "codebox.json");
    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    expect(config).to.have.property("dockerImage", "node:18");
    expect(config).to.have.property("debug", true);
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