# Codebox

Codebox is an MCP Server for running commands within Docker containers for specific projects. It simplifies the process of executing code and commands in isolated, reproducible environments.

## Installation

```bash
npm install -g @codespin/codebox
```

## Usage

### Configure your MCP Client (such as LibreChat, Claude Desktop)

This is how you start the tool. Configure your MCP Client accordingly.

```bash
codebox start
```

For LibreChat, it'll be:

```yaml
mcpServers:
  codebox:
      type: stdio
      command: codebox
      args:
        - start
      timeout: 30000             # 30 second timeout for commands
      initTimeout: 10000         # 10 second timeout for initialization
```

### Managing Projects

#### Adding a Project

Register a project directory with Codebox:

```bash
# Register current directory as a project with a Docker image
codebox project add --image node:18

# Register a specific directory as a project
codebox project add /path/to/project --image python:3.9

# Register with a custom name
codebox project add /path/to/project --image node:18 --name my-node-app

# Specify a custom path inside the container (default is /workspace)
codebox project add --image node:18 --containerPath /my-project

# Connect to a specific Docker network (for Docker Compose environments)
codebox project add --image node:18 --network my_compose_network

# Use a running container instead of a new container
codebox project add --container my-running-container
```

#### Listing Projects

View all registered projects:

```bash
codebox project list
```

#### Removing a Project

Remove a project from the registry:

```bash
# Remove by name
codebox project remove my-project-name

# Remove by path
codebox project remove /path/to/project

# Remove current directory
codebox project remove
```

### Using with AI Assistants

Codebox implements the Model Context Protocol (MCP), allowing AI assistants to:

1. Execute commands in project containers
2. Read and write files within projects
3. Perform batch operations

## Project Configuration

Projects are stored in `~/.codespin/codebox.json` with the following structure:

```json
{
  "projects": [
    {
      "name": "my-node-app",
      "hostPath": "/home/user/projects/my-node-app",
      "containerPath": "/my-project",
      "dockerImage": "node:18",
      "network": "my_compose_network"
    },
    {
      "name": "python-api",
      "hostPath": "/home/user/projects/python-api",
      "containerName": "running-python-container"
    }
  ],
  "debug": false
}
```

Each project has:

- `name`: Identifier for the project
- `hostPath`: Path on the host machine
- `containerPath`: (Optional) Path in the container where the project is mounted (defaults to `/workspace`)
- `dockerImage`: Docker image to use for new containers
- `containerName`: Name of an existing running container
- `network`: (Optional) Docker network to connect the container to

## Troubleshooting

If you experience issues with Docker connectivity, ensure:

1. Docker is running
2. You have appropriate permissions
3. Containers are accessible

For detailed logs, set `"debug": true` in your `~/.codespin/codebox.json` file.

## License

MIT