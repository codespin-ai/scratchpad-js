# Codebox

Built for LLM Agents to make code changes safely. Executes commands in Docker containers with local filesystem access scoped to project directories.

## Install

```bash
npm install -g @codespin/codebox
```

Requires Docker installed.

## Architecture

- Commands execute in isolated Docker containers with volume mounts to project directories
- File operations are constrained to registered project paths
- Containers have network access but isolated filesystem

## Usage

```bash
# Initialize project with Docker image
# Creates .codespin/codebox.json with project config
codebox init --image node:18

# Initialize system-wide Docker image configuration
# Creates $HOME/.codespin/codebox.json with global config
codebox init --system --image node:18

# Register projects
codebox project add /path/to/project
codebox project list
codebox project remove /path/to/project

# This is called by the client (don't do this manually)
codebox start
```

## Configuration System

Codebox uses a hierarchical configuration system:

1. **Project-specific configuration**: Located at `.codespin/codebox.json` within each project
2. **System-wide configuration**: Located at `$HOME/.codespin/codebox.json`

When a Docker image is needed for a project, Codebox checks:

- First, the project-specific configuration
- If not found or no `dockerImage` defined, falls back to the system-wide configuration

This allows you to define a default image for all projects while allowing project-specific overrides.

### Debug Logging

You can enable debug logging by adding a `debug` flag to your system-wide configuration:

```json
{
  "dockerImage": "node:18",
  "debug": true
}
```

When debug logging is enabled:

- All MCP method calls will be logged to `$HOME/.codespin/logs/*.log` files (organized by date)
- Request payloads and responses will be saved to `$HOME/.codespin/logs/requests/` directory
- Each log entry includes method name, timestamp, processing time, and a unique request ID
- Request and response files are named with date and request ID for easy correlation

This is useful for debugging, development, and auditing purposes. Log files should be cleaned up periodically as they are not automatically rotated or deleted.

## Docker Image Requirements

The Docker image must:

- Contain all development tools needed (compilers, interpreters, package managers)
- Have compatible versions with your project dependencies
- Be pre-built and available locally or in a registry

## Testing

Codebox includes a comprehensive test suite using Mocha and Chai. The tests cover:

- Logger utility and debug mode functionality
- MCP tools for file operations (write_file, write_batch_files)
- MCP tools for project management (list_projects, get_project_config)
- Logging wrapper for debugging and request tracing

To run the tests:

```bash
# Run all tests
npm test

# Run specific test category
npm run test:grep "Logger Utility"
npm run test:grep "File MCP Tools"
```

The test suite uses a sandbox environment with temporary directories to avoid affecting your actual system configuration. It mocks the necessary components to isolate test executions and ensure test stability.

## Complete Workflow Example

```bash
# Setup project
mkdir my-project && cd my-project
git init
npm init -y

# Initialize codebox with Node.js image
codebox init --image node:18

# Or set a system-wide default Docker image
codebox init --system --image node:18

# Register the project
codebox project add $(pwd)

# Start MCP server for agent interaction
codebox start
```

## MCP Tools

### execute_command

```typescript
{
  command: string; // Command to execute
  projectDir: string; // Absolute project path
}
```

### execute_batch_commands

```typescript
{
  projectDir: string; // Absolute project path
  commands: string[]; // Array of commands to execute in sequence
  stopOnError: boolean; // Optional: Whether to stop execution if a command fails (default: true)
}
```

The batch command tool allows executing multiple commands in sequence with a single LLM call, reducing API costs and improving efficiency. All commands run in the same Docker container session, preserving environment state between commands.

Example usage:

```json
{
  "projectDir": "/path/to/project",
  "commands": ["npm install", "npm test", "npm run build"],
  "stopOnError": true
}
```

### write_file

```typescript
{
  projectDir: string; // Absolute project path
  filePath: string; // Relative path from project root
  content: string; // Content to write
  mode: "overwrite" | "append";
}
```

### write_batch_files

```typescript
{
  projectDir: string; // Absolute project path
  files: [
    {
      filePath: string; // Relative path from project root
      content: string; // Content to write
      mode: "overwrite" | "append";
    }
  ];
  stopOnError: boolean; // Optional: Whether to stop execution if a file write fails (default: true)
}
```

The batch file tool allows writing multiple files in a single LLM call, reducing API costs and improving efficiency. This is particularly useful when you need to create or modify multiple tiny/small files at once.

Example usage:

```json
{
  "projectDir": "/path/to/project",
  "files": [
    {
      "filePath": "src/config.ts",
      "content": "export const config = { debug: true };",
      "mode": "overwrite"
    },
    {
      "filePath": "src/constants.ts",
      "content": "export const API_URL = 'https://api.example.com';",
      "mode": "overwrite"
    }
  ],
  "stopOnError": true
}
```

### list_projects

Lists registered projects with status. For each project, shows:

- Path to the project
- Whether the project exists
- Configuration status
- Docker image being used
- Whether the Docker image is coming from system configuration

### get_project_config

```typescript
{
  projectDir: string; // Absolute project path
}
```

## Agent Prompt

```
These tools will help you:
- Reading and modifying source code
- Running tests or build commands
- Executing project-specific development tools
- Code analysis and refactoring

Available tools:
- list_projects: See available projects
- execute_command: Run commands in a Docker container.
- execute_batch_commands: Run multiple commands in sequence with a single call
- write_file: Create or modify files
- write_batch_files: Create or modify multiple files in a single call
- get_project_config: Get project details

TOKEN USAGE WARNING:
1. Navigate directories incrementally (avoid recursive listings) unless you know that there aren't many entries
2. Skip dependency/build directories (node_modules, dist, target, etc)
3. Request only the files you need
4. If you're requesting files which can potentially be large, check file sizes before requesting full content (use 'wc -c <filename>' or 'ls -l')

Minimize calls to the LLM:
1. Use execute_batch_commands for predictable command sequences. For example "cat a.txt", "cat b.txt". They're executed sequentially, and results returned.
2. Use write_batch_files when creating multiple small files at once. But if they're large files (>5KB), use separate calls.

Efficient workflow example:

GOOD:
> // Start with this. Get all projects.
> list_projects

// Find what's in the src directory.
> execute_command {projectDir: "/path", command: "ls src"}

// Find a specific file.
> execute_command {projectDir: "/path", command: "cat src/config.ts"}

// Write a specific file.
> write_file {projectDir: "/path", filePath: "src/config.ts", content: "..."}

> // Run multiple commands at once.
> execute_batch_commands {projectDir: "/path", commands: ["cat a.txt", "cat b.txt"]}

> // Another example of batching commands
> execute_batch_commands {projectDir: "/path", commands: ["npm install", "npm test"]}

> // If files are small, write them out at once
> write_batch_files {projectDir: "/path", files: [{filePath: "file1.txt", content: "..."}, {filePath: "file2.txt", content: "..."}]}

BAD (wastes tokens):
> // Gets a big list of files. What if there's a huge node_modules in it?
> execute_command {projectDir: "/path", command: "find . -type f"} // Lists everything

> // Never go into node_modules, unless the user specifically asks for it.
> execute_command {projectDir: "/path", command: "cat node_modules/package/README.md"}

> // Multiple separate write_file calls for small files
> write_file {projectDir: "/path", filePath: "file1.txt", content: "..."}
> write_file {projectDir: "/path", filePath: "file2.txt", content: "..."}

Remember:
- Work incrementally through directories
- Avoid large file reads unless necessary, ask for permission as needed
- Commands execute in an isolated Docker container
- You must always use write_file to write file content, instead of something like echoing to a file.
- If the user asks for the output of a command, you must print the output of execute_command verbatim in a markdown codeblock.
- Use batch commands when you know a fixed sequence of commands needs to be executed. This saves API costs and time.
- Use write_batch_files to write multiple small files because this will reduce  API calls, which happen after every tool use.
```

## License

MIT
