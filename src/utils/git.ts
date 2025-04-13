import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let gitRoot: string | undefined;
let notUnderGit = false;

export async function getGitRoot(
  workingDir: string
): Promise<string | undefined> {
  if (notUnderGit) {
    return undefined;
  }

  try {
    if (!gitRoot) {
      const result = await execAsync(
        "git rev-parse --show-toplevel",
        { cwd: workingDir }
      );

      // trim is used to remove the trailing newline character from the output
      gitRoot = result.stdout.trim();
    }
    return gitRoot;
  } catch (error: any) {
    notUnderGit = true;
    return undefined;
  }
}
