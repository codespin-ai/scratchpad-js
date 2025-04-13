# Codebox

Codebox executes commands in Docker containers with local filesystem access. Built for developers who need isolated environments for testing, development, or running untrusted code.

## Core Functionality

- Runs commands in isolated Docker containers with your project files mounted
- Tracks multiple project directories across your system
- Exposes an MCP (Model Context Protocol) server for programmatic access
- Integrates with git repositories for project scoping

## Prerequisites

- Node.js v16+
- Docker daemon running
- Git

## Installation

```bash
npm install -g @codespin/codebox
```

## Setup

Initialize a project:

```bash
cd your-project
codebox init --image node:18
```

This creates `.codespin/codebox.json` with your Docker image configuration.

Register projects for access:

```bash
# Add project
codebox project add /path/to/project

# List registered projects
codebox project list

# Remove project
codebox project remove /path/to/project
```

Start the MCP server:

```bash
codebox start
```

## Architecture

Codebox works by:

1. Mounting your project directory at `/home/project` inside the container
2. Running commands in the specified Docker environment
3. Streaming output back to the client

This provides isolation while maintaining access to local files.

## MCP Server API

### execute_command

Runs a command in the project's Docker container

Parameters:

- `command`: Shell command to execute
- `projectDir`: Absolute path to project directory

### list_projects

Returns all registered project paths

## Configuration

Project-level (`.codespin/codebox.json`):

```json
{
  "dockerImage": "node:18"
}
```

Global (`$HOME/.codespin/projects.json`):

```json
{
  "projects": ["/path/to/project1", "/path/to/project2"]
}
```

## Security

- Commands can only be executed in registered project directories
- Projects must be explicitly registered using `codebox project add` before use
- Each project requires its own Docker configuration
- Project directories are mounted read-write in containers at `/home/project`

## Development

```bash
# Build
npm run build

# Run locally
npm start -- [command]
```

## License

MIT
