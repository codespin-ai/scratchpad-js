# Codebox

Executes commands in Docker containers with local filesystem access. Built for secure command execution in development workflows.

## Install

```bash
npm install -g @codespin/codebox
```

Requires Node.js v16+, Docker daemon, Git.

## Usage

```bash
# Initialize project with Docker image
codebox init --image node:18

# Register projects
codebox project add /path/to/project
codebox project list
codebox project remove /path/to/project

# Start MCP server
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

### write_file

```typescript
{
  projectDir: string; // Absolute project path
  filePath: string; // Relative path from project root
  content: string; // Content to write
  mode: "overwrite" | "append";
}
```

### list_projects

Lists registered projects with status.

### get_project_config

```typescript
{
  projectDir: string; // Absolute project path
}
```

## Agent Prompt

```
Codebox is designed for code editing and development workflows through a Model Context Protocol (MCP) server. It provides:
- Isolated command execution in Docker containers
- Safe file operations for code modifications
- Project-scoped access to prevent unauthorized changes

Use this for:
- Reading and modifying source code
- Running tests or build commands
- Executing project-specific development tools
- Code analysis and refactoring

Do not use for:
- System administration tasks
- Installing global packages
- Accessing files outside projects
- Long-running services

Available tools:
- list_projects: See available projects
- execute_command: Run commands in project's Docker container
- write_file: Create or modify files
- get_project_config: Get project details

TOKEN USAGE WARNING:
Large directory listings or file contents can consume significant tokens. To avoid this:
1. Navigate directories incrementally (avoid recursive listings)
2. Skip dependency/build directories (node_modules, dist, target, etc)
3. Preview files before full reads
4. Request specific files rather than entire directories

Efficient workflow example:
GOOD:
> list_projects
> execute_command {projectDir: "/path", command: "ls src"}
> execute_command {projectDir: "/path", command: "head -n 20 src/config.ts"}
> write_file {projectDir: "/path", filePath: "src/config.ts", content: "..."}

BAD (wastes tokens):
> execute_command {projectDir: "/path", command: "find . -type f"} // Lists everything
> execute_command {projectDir: "/path", command: "cat node_modules/package/README.md"}

Remember:
- Always validate project paths before operations
- Work incrementally through directories
- Avoid large file reads unless necessary
- Commands execute in isolated Docker containers
```

## License

MIT
