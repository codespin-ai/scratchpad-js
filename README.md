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
  "commands": [
    "npm install",
    "npm test",
    "npm run build"
  ],
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
Codebox is Model Context Protocol (MCP) server for LLM Agents to make code changes to a project:
- Isolated command execution in Docker containers
- Safe file operations for code modifications
- Project-scoped access to prevent unauthorized changes

Use this for:
- Reading and modifying source code
- Running tests or build commands
- Executing project-specific development tools
- Code analysis and refactoring

Available tools:
- list_projects: See available projects
- execute_command: Run commands in project's Docker container
- execute_batch_commands: Run multiple commands in sequence with a single call
- write_file: Create or modify files
- write_batch_files: Create or modify multiple files in a single call
- get_project_config: Get project details

TOKEN USAGE WARNING:
Large directory listings or file contents can consume significant tokens. To avoid this:
1. Navigate directories incrementally (avoid recursive listings)
2. Skip dependency/build directories (node_modules, dist, target, etc)
3. Preview files before full reads
4. Request specific files rather than entire directories
5. Check file sizes before requesting full content (use 'wc -c <filename>' or 'ls -l')
6. Use execute_batch_commands for predictable command sequences
7. Use write_batch_files when creating multiple small files at once

Efficient workflow example:
GOOD:
> list_projects
> execute_command {projectDir: "/path", command: "ls src"}
> execute_command {projectDir: "/path", command: "ls -l src/config.ts"} # Check file size
> execute_command {projectDir: "/path", command: "head -n 20 src/config.ts"}
> write_file {projectDir: "/path", filePath: "src/config.ts", content: "..."}
> execute_batch_commands {projectDir: "/path", commands: ["npm install", "npm test"]}
> write_batch_files {projectDir: "/path", files: [{filePath: "file1.txt", content: "..."}, {filePath: "file2.txt", content: "..."}]}

BAD (wastes tokens):
> execute_command {projectDir: "/path", command: "find . -type f"} // Lists everything
> execute_command {projectDir: "/path", command: "cat node_modules/package/README.md"}
> execute_command {projectDir: "/path", command: "cat src/large-file.ts"} // Without checking size first
> write_file {projectDir: "/path", filePath: "file1.txt", content: "..."} // Multiple separate write_file calls
> write_file {projectDir: "/path", filePath: "file2.txt", content: "..."} // for small files

Remember:
- Work incrementally through directories
- Avoid large file reads unless necessary, ask for permission as needed
- Check file sizes before requesting full content (files >100KB can waste many tokens)
- Commands execute in an isolated Docker container
- You must use write_file to write file content, instead of something like echoing to a file.
- If the user asks for the output of a command, you may print the output of execute_command verbatim in a markdown codeblock.
- Of course, if you know the sizes of files you're requesting (via a previous 'ls' for example), you don't need to ask every time.
- Use batch commands when you know a fixed sequence of commands needs to be executed. This saves API costs and time.
- Use write_batch_files when writing multiple small files at once to reduce API calls.
```

## License

MIT