#!/bin/bash

# Delete old test directory if it exists
if [ -d "./src/test" ]; then
  # Preserve test utilities
  mkdir -p ./tmp_test_utils
  if [ -f "./src/test/setup.ts" ]; then
    cp ./src/test/setup.ts ./tmp_test_utils/
  fi
  if [ -f "./src/test/mockUtils.ts" ]; then
    cp ./src/test/mockUtils.ts ./tmp_test_utils/
  fi
  if [ -f "./src/test/mcpTestUtil.ts" ]; then
    cp ./src/test/mcpTestUtil.ts ./tmp_test_utils/
  fi
  if [ -f "./src/test/osWrapper.ts" ]; then
    cp ./src/test/osWrapper.ts ./tmp_test_utils/
  fi

  # Remove old test directory
  rm -rf ./src/test
  echo "Deleted old test directory"
fi

# Create new test directory structure
mkdir -p ./src/test/cli/commands
mkdir -p ./src/test/config
mkdir -p ./src/test/docker
mkdir -p ./src/test/fs
mkdir -p ./src/test/mcp/handlers
mkdir -p ./src/test/logging
mkdir -p ./src/test/utils

# Create empty test files
touch ./src/test/cli/commands/project.test.ts
touch ./src/test/cli/commands/start.test.ts
touch ./src/test/cli/index.test.ts

touch ./src/test/config/projectConfig.test.ts

touch ./src/test/docker/execution.test.ts

touch ./src/test/fs/fileIO.test.ts
touch ./src/test/fs/pathValidation.test.ts

touch ./src/test/mcp/handlers/batch.test.ts
touch ./src/test/mcp/handlers/batchFiles.test.ts
touch ./src/test/mcp/handlers/execute.test.ts
touch ./src/test/mcp/handlers/files.test.ts
touch ./src/test/mcp/handlers/projects.test.ts
touch ./src/test/mcp/logging.test.ts
touch ./src/test/mcp/server.test.ts

touch ./src/test/logging/logger.test.ts

# Restore test utilities
if [ -d "./tmp_test_utils" ]; then
  if [ -f "./tmp_test_utils/setup.ts" ]; then
    cp ./tmp_test_utils/setup.ts ./src/test/utils/
  fi
  if [ -f "./tmp_test_utils/mockUtils.ts" ]; then
    cp ./tmp_test_utils/mockUtils.ts ./src/test/utils/
  fi
  if [ -f "./tmp_test_utils/mcpTestUtil.ts" ]; then
    cp ./tmp_test_utils/mcpTestUtil.ts ./src/test/utils/
  fi
  if [ -f "./tmp_test_utils/osWrapper.ts" ]; then
    cp ./tmp_test_utils/osWrapper.ts ./src/test/utils/
  fi
  rm -rf ./tmp_test_utils
fi

echo "Created new test directory structure"