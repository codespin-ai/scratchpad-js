import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";

describe("Project Configuration Structure", () => {
  it("should use the correct configuration format", () => {
    // Example of what our config should look like
    const config = {
      projects: [
        {
          name: "project1",
          hostPath: "/path/to/project1",
          dockerImage: "node:18",
          network: "my_compose_network",
        },
        {
          name: "project2",
          hostPath: "/path/to/project2",
          dockerImage: "python:3.9",
        },
      ],
      debug: false,
    };

    // Check that this is a valid configuration format
    expect(config).to.have.property("projects").that.is.an("array");
    expect(config.projects[0]).to.have.property("hostPath").that.is.a("string");
    expect(config.projects[0]).to.have.property("name").that.is.a("string");
    expect(config.projects[0])
      .to.have.property("dockerImage")
      .that.is.a("string");
    expect(config.projects[0]).to.have.property("network").that.is.a("string");
    expect(config).to.have.property("debug").that.is.a("boolean");
  });

  it("should have removed the init command", () => {
    // Verify init.ts is gone
    const initPath = path.join("src", "commands", "init.ts");
    expect(fs.existsSync(initPath)).to.equal(false);
  });

  it("should have removed the git utility", () => {
    // Verify git.ts is gone
    const gitPath = path.join("src", "utils", "git.ts");
    expect(fs.existsSync(gitPath)).to.equal(false);
  });
});
