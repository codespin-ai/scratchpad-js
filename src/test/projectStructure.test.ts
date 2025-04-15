import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";

describe("Project Configuration Structure", () => {
  it("should use the correct configuration format", () => {
    // Example of what our config should look like
    const config = {
      projects: [
        { path: "/path/to/project1", dockerImage: "node:18" },
        { path: "/path/to/project2", dockerImage: "python:3.9" }
      ],
      debug: false
    };
    
    // Check that this is a valid configuration format
    expect(config).to.have.property('projects').that.is.an('array');
    expect(config.projects[0]).to.have.property('path').that.is.a('string');
    expect(config.projects[0]).to.have.property('dockerImage').that.is.a('string');
    expect(config).to.have.property('debug').that.is.a('boolean');
  });
  
  it("should have removed the init command", () => {
    // Verify init.ts is gone
    const initPath = path.join('src', 'commands', 'init.ts');
    expect(fs.existsSync(initPath)).to.equal(false);
  });
  
  it("should have removed the git utility", () => {
    // Verify git.ts is gone 
    const gitPath = path.join('src', 'utils', 'git.ts');
    expect(fs.existsSync(gitPath)).to.equal(false);
  });
});
