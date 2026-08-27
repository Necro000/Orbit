// @ts-check
/** @type {import("eslint").Linter.Config} */
module.exports = {
  ...require("@orbit/config/eslint-base"),
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  env: { node: true, es2022: true },
  ignorePatterns: ["node_modules/", "dist/", "vitest.config.ts"],
};