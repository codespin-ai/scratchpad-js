:::thinking
I need to create a comprehensive README for a project called "Scratchpad" based on the specifications given. Let's outline what this README should include:

1. Project Title and Description
2. Installation Instructions
3. Usage Guide including:
   - `scratchpad init` - Initialize a new scratchpad in a git repository
   - `scratchpad start` - Start the MCP server
   - `scratchpad project add <dirname>` - Add a project to the list
   - `scratchpad project remove <dirname>` - Remove a project from the list
4. How it works - explanation of Docker usage
5. Requirements
6. Contributing guidelines
7. License information

Let me draft this README:
:::

# Scratchpad

Scratchpad is a development tool that lets you execute commands in Docker containers for your projects. It provides an MCP (Model Context Protocol) server that allows controlled execution environments for your code, making it ideal for testing, development, and AI-assisted coding workflows.

## Features

- Execute commands in isolated Docker containers with your project files mounted
- Manage multiple projects across your system
- Simple CLI interface for configuration and server management
- Seamless integration with git repositories
- Built on the Model Context Protocol for easy integration with AI tools

## Installation

```bash
# Install globally
npm install -g scratchpad

# Or use with npx
npx scratchpad [command]
```

## Requirements

- Node.js (v16 or newer)
- Docker installed and running
- Git (for repository management)

## Usage

### Initialize a Scratchpad in a Git Repository

```bash
cd your-git-project
scratchpad init
```

This will:

- Verify you're in a git repository
- Prompt you for a Docker image to use for this project
- Create a `.codespin/scratchpad.json` configuration file

### Add Projects to Your Scratchpad Registry

```bash
# Add a project directory
scratchpad project add /path/to/your/project

# Remove a project
scratchpad project remove /path/to/your/project
```

Your project list is stored in `$HOME/.codespin/projects.json`.

### Start the MCP Server

```bash
scratchpad start
```

This starts the MCP server, enabling command execution through the protocol.

## How It Works

Scratchpad uses Docker containers to provide isolated environments for running commands. When you execute a command:

1. Your project directory is mounted inside the container
2. The command runs in the specified Docker environment
3. Output is captured and returned

This ensures consistent execution environments and protects your host system from potentially harmful commands.

## Configuration Files

- Project-specific: `.codespin/scratchpad.json` in each git repository root
- Global projects list: `$HOME/.codespin/projects.json`

## For Developers

Scratchpad uses the Model Context Protocol (MCP) to provide a standardized interface for tools like AI assistants to execute commands in a controlled environment.

## License

MIT
