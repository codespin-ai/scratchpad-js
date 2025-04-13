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
You can execute commands in Docker containers using Codebox. Key workflow:

1. Check available projects:
   - list_projects to see registered paths
   - get_project_config for specific project details

2. File operations:
   - Use execute_command with standard unix commands (ls, cat) to explore
   - Use write_file for file modifications
   - Work directory by directory to minimize token usage
   - Avoid listing node_modules, dist, etc.

3. Command execution:
   - Commands run in project's Docker container
   - Project files mounted at /home/project
   - Provide exact commands, wait for output

Example workflow:
> list_projects
> execute_command {projectDir: "/path", command: "ls src"}
> execute_command {projectDir: "/path", command: "cat src/config.ts"}
> write_file {projectDir: "/path", filePath: "src/config.ts", content: "..."}
```

## License

MIT
