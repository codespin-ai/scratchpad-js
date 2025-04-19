#!/bin/bash

# Create test directory structure
echo "Creating test directory structure..."

# Create main test directories
mkdir -p ./src/test/integration/config
mkdir -p ./src/test/integration/fs
mkdir -p ./src/test/integration/docker
mkdir -p ./src/test/integration/mcp/handlers

# Create integration test setup
touch ./src/test/integration/setup.ts
touch ./src/test/integration/testUtils.ts

# Create config tests
touch ./src/test/integration/config/projectConfig.test.ts

# Create filesystem tests
touch ./src/test/integration/fs/fileIO.test.ts
touch ./src/test/integration/fs/pathValidation.test.ts

# Create docker tests
touch ./src/test/integration/docker/execution.test.ts

# Create MCP server tests
touch ./src/test/integration/mcp/server.test.ts

# Create MCP handler tests
touch ./src/test/integration/mcp/handlers/files.test.ts
touch ./src/test/integration/mcp/handlers/projects.test.ts
touch ./src/test/integration/mcp/handlers/execute.test.ts
touch ./src/test/integration/mcp/handlers/batch.test.ts
touch ./src/test/integration/mcp/handlers/batchFiles.test.ts

echo "Test file structure created successfully!"