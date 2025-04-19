import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

describe("CLI Index", () => {
  describe("getVersion", () => {
    it("should have version information", () => {
      // Use fileURLToPath instead of __dirname
      const currentFilePath = fileURLToPath(import.meta.url);
      const currentDir = path.dirname(currentFilePath);
      const packagePath = path.resolve(currentDir, "../../../../package.json");
      
      // Check that package.json exists and has a version
      expect(fs.existsSync(packagePath)).to.be.true;
      const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      
      expect(packageJson.version).to.be.a("string");
      expect(packageJson.version).to.match(/^\d+\.\d+\.\d+/);
    });
  });
});