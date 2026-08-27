// @ts-check
/** @type {import("eslint").Linter.Config} */
module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:import/recommended",
    "plugin:import/typescript",
  ],
  rules: {
    // Keep files and functions short (brain.md §6)
    "max-lines": ["warn", { max: 200, skipBlankLines: true, skipComments: true }],
    "max-lines-per-function": ["warn", { max: 40, skipBlankLines: true, skipComments: true }],
    "complexity": ["warn", 10],
    // TypeScript hygiene
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    // Import ordering
    "import/order": ["warn", { "newlines-between": "always", alphabetize: { order: "asc" } }],
    "import/no-duplicates": "error",
  },
  ignorePatterns: [
    "node_modules/", "dist/", ".next/", "build/",
    "*.config.js", "*.config.cjs", "*.config.mjs"
  ],
};