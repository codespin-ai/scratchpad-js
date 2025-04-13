#!/usr/bin/env node

import yargs from "yargs";
import { init } from "./commands/init.js";
import { start } from "./commands/start.js";
import { addProject, listProjects, removeProject } from "./commands/project.js";
import { setInvokeMode } from "./utils/invokeMode.js";
import process from "node:process";

// Export utility functions
export * as git from "./utils/git.js";

setInvokeMode("cli");

export async function main() {
  yargs(process.argv.slice(2))
    .command(
      "init",
      "Initialize a codebox configuration for a git repository",
      (yargs) =>
        yargs
          .option("force", {
            type: "boolean",
            demandOption: false,
            describe: "Force overwrite the existing codebox.json config file",
          })
          .option("image", {
            type: "string",
            demandOption: true,
            describe: "Docker image to use for this project",
          })
          .option("system", {
            type: "boolean",
            demandOption: false,
            describe: "Create a system-level configuration at $HOME/.codespin/codebox.json",
          }),
      async (argv) => {
        await init(argv as any, { workingDir: process.cwd() });
        writeToConsole("Codebox initialization completed.");
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
      "project",
      "Project management commands",
      (yargs) => {
        return yargs
          .command(
            "add <dirname>",
            "Add a project directory to the registry",
            (yargs) => {
              return yargs.positional("dirname", {
                describe: "Path to the project directory",
                type: "string",
                demandOption: true,
              });
            },
            async (argv) => {
              await addProject(argv as any, { workingDir: process.cwd() });
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
              await removeProject(argv as any, { workingDir: process.cwd() });
            }
          )
          .demandCommand(1, "You must specify a project command (add/remove)")
          .command("list", "List all registered projects", {}, async () => {
            await listProjects({ workingDir: process.cwd() });
          })
          .demandCommand(
            1,
            "You must specify a project command (add/remove/list)"
          );
      },
      () => {}
    )
    .command("version", "Display the current version", {}, async () => {
      writeToConsole("Codebox v1.0.0");
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