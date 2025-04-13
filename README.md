# Codebox

Codebox is a development tool that lets you execute commands in Docker containers for your projects. It provides an MCP (Model Context Protocol) server that allows controlled execution environments for your code, making it ideal for testing, development, and AI-assisted coding workflows.

## Features

- Execute commands in isolated Docker containers with your project files mounted
- Manage multiple projects across your system
- Simple CLI interface for configuration and server management
- Seamless integration with git repositories
- Built on the Model Context Protocol for easy integration with AI tools

## Installation

```bash
# Install globally
npm install -g codebox

# Or use with npx
npx codebox [command]
```

## Requirements

- Node.js (v16 or newer)
- Docker installed and running
- Git (for repository management)

## Usage

### Initialize a Scratchpad in a Git Repository

```bash
cd your-git-project
codebox init --image node:18
```

This will:
- Verify you're in a git repository
- Create a `.codespin/codebox.json` configuration file with the specified Docker image
- Use `--force` to overwrite an existing configuration

### Add Projects to Your Scratchpad Registry

```bash
# Add a project directory
codebox project add /path/to/your/project

# Remove a project
codebox project remove /path/to/your/project
```

Your project list is stored in `$HOME/.codespin/projects.json`.

### Start the MCP Server

```bash
codebox start
```

This starts the MCP server, enabling command execution through the protocol.

## How It Works

Scratchpad uses Docker containers to provide isolated environments for running commands. When you execute a command:

1. Your project directory is mounted inside the container at `/home/project`
2. The command runs in the specified Docker environment
3. Output is captured and returned

This ensures consistent execution environments and protects your host system from potentially harmful commands.

## MCP Server Tools

The MCP server provides the following tools:

### `execute_command`

Executes a command in a Docker container for a specific project.

Parameters:
- `command`: The command to execute in the container
- `projectDir`: The absolute path to the project directory

### `list_projects`

Lists all registered projects.

## Configuration Files

- Project-specific: `.codespin/codebox.json` in each git repository root
- Global projects list: `$HOME/.codespin/projects.json`

## Development

To build the project:

```bash
npm run build
```

To run locally:

```bash
npm start -- [command]
```

## License

MIT