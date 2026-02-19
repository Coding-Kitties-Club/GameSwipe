import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";

export default [
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        plugins: { import: importPlugin },
        languageOptions: {
            parserOptions: {
                projectService: true
            }
        },
        rules: {
            "import/no-unresolved": "off"
        }
    },
    {
        files: ["apps/frontend/**/*.{ts,tsx}"],
        rules: {
            "react/react-in-jsx-scope": "off"
        }
    },
    {
        ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/node_modules/**"]
    }
];
