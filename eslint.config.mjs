// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Define ignore patterns here
    ignores: ["node_modules/**", "dist/**", ".git/**", ".vscode/**"],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  // Adding strict configuration for more strict linting
  tseslint.configs.strict,
  // Adding stylistic configuration for consistent code styling
  tseslint.configs.stylistic,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  }
);
