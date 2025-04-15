// src/commands/start.ts
import { startServer } from "../mcp/server.js";

interface CommandContext {
  workingDir: string;
}

export async function start(_context: CommandContext): Promise<void> {
  await startServer();
}
