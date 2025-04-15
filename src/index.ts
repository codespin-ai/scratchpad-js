#!/usr/bin/env node

import yargs from "yargs";
import { start } from "./commands/start.js";
import { addProject, listProjects, removeProject } from "./commands/project.js";
import { setInvokeMode } from "./utils/invokeMode.js";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

setInvokeMode("cli");

// Function to get the version from package.json
export function getVersion() {
  // Get the directory name of the current module
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // Read package.json from the root directory
  const packagePath = path.resolve(__dirname, "../package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  return `Codebox v${packageJson.version}`;
}

export async function main() {
  await yargs(process.argv.slice(2))
    .command(
      "start",
      "Start the MCP server for executing commands in containers",
      (yargs) => yargs,
      async () => {
        await start({ workingDir: process.cwd() });
      }
    )
    .command(
      "project",
      "Project management commands",
      (yargs) => {
        return yargs
          .command(
            "add <dirname>",
            "Add a project directory to the registry",
            (yargs) => {
              return yargs
                .positional("dirname", {
                  describe: "Path to the project directory",
                  type: "string",
                  demandOption: true,
                })
                .option("image", {
                  type: "string",
                  demandOption: true,
                  describe: "Docker image to use for this project",
                });
            },
            async (argv) => {
              await addProject(
                { dirname: argv.dirname, image: argv.image },
                { workingDir: process.cwd() }
              );
            }
          )
          .command(
            "remove <dirname>",
            "Remove a project directory from the registry",
            (yargs) => {
              return yargs.positional("dirname", {
                describe: "Path to the project directory to remove",
                type: "string",
                demandOption: true,
              });
            },
            async (argv) => {
              await removeProject(
                { dirname: argv.dirname },
                { workingDir: process.cwd() }
              );
            }
          )
          .demandCommand(1, "You must specify a project command (add/remove)")
          .command("list", "List all registered projects", {}, async () => {
            await listProjects();
          })
          .demandCommand(
            1,
            "You must specify a project command (add/remove/list)"
          );
      },
      () => {
        /* empty function required by yargs */
      }
    )
    .command("version", "Display the current version", {}, async () => {
      writeToConsole(getVersion());
    })
    .demandCommand(1, "You need to specify a command")
    .showHelpOnFail(true)
    .help("help")
    .alias("h", "help").argv;
}

function writeToConsole(text?: string) {
  console.log(text ?? "");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
