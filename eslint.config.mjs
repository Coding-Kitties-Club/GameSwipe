import js from "@eslint/js";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = __dirname;

const tsProjects = [
  path.join(repoRoot, "apps/backend/tsconfig.json"),
  path.join(repoRoot, "apps/backend/tsconfig.test.json"),
  path.join(repoRoot, "apps/frontend/tsconfig.app.json"),
  path.join(repoRoot, "packages/shared/tsconfig.json")
];

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.vite/**",
      "**/.vite-temp/**",
      "**/*.tsbuildinfo",

      "**/vite.config.*",
      "**/vitest.config.*",
      "**/eslint.config.*",

      "**/*.d.ts",
      "**/*.d.ts.map",
      "**/*.js.map"
    ]
  },

  js.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked.map((c) => ({
    ...c,
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ...c.languageOptions,
      parserOptions: {
        ...c.languageOptions?.parserOptions,
        tsconfigRootDir: repoRoot,
        project: tsProjects
      },
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  })),

  {
    files: ["apps/frontend/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
    }
  },

  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    }
  }
];
