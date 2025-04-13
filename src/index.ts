#!/usr/bin/env node

import yargs from "yargs";
import { init } from "./commands/init.js";
import { start } from "./commands/start.js";
import { addProject, removeProject } from "./commands/project.js";
import { setInvokeMode } from "./utils/invokeMode.js";
import process from "node:process";

// Export utility functions
export * as git from "./utils/git.js";

setInvokeMode("cli");

export async function main() {
  yargs(process.argv.slice(2))
    .command(
      "init",
      "Initialize a scratchpad configuration for a git repository",
      (yargs) =>
        yargs
          .option("force", {
            type: "boolean",
            demandOption: false,
            describe:
              "Force overwrite the existing scratchpad.json config file",
          })
          .option("image", {
            type: "string",
            demandOption: true,
            describe: "Docker image to use for this project",
          }),
      async (argv) => {
        await init(argv as any, { workingDir: process.cwd() });
        writeToConsole("Scratchpad initialization completed.");
      }
    )
    .command(
      "start",
      "Start the MCP server for executing commands in containers",
      (yargs) => yargs,
      async () => {
        await start({ workingDir: process.cwd() });
      }
    )
    .command(
      "project add <dirname>",
      "Add a project directory to the registry",
      (yargs) =>
        yargs.positional("dirname", {
          describe: "Path to the project directory",
          demandOption: true,
          type: "string",
        }),
      async (argv) => {
        await addProject(argv as any, { workingDir: process.cwd() });
        writeToConsole(`Project ${argv.dirname} successfully added.`);
      }
    )
    .command(
      "project remove <dirname>",
      "Remove a project directory from the registry",
      (yargs) =>
        yargs.positional("dirname", {
          describe: "Path to the project directory to remove",
          demandOption: true,
          type: "string",
        }),
      async (argv) => {
        await removeProject(argv as any, { workingDir: process.cwd() });
        writeToConsole(`Project ${argv.dirname} successfully removed.`);
      }
    )
    .command("version", "Display the current version", {}, async () => {
      writeToConsole("Scratchpad v1.0.0");
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
