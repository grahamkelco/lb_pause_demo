import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import checkFile from "eslint-plugin-check-file";

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "check-file": checkFile,
    },
    rules: {
      // Enforce snake_case filenames
      "check-file/filename-naming-convention": [
        "error",
        { "**/*.ts": "SNAKE_CASE" },
        { ignoreMiddleExtensions: true },
      ],

      // Enforce naming conventions: PascalCase for types, camelCase for variables/methods
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "enumMember",
          format: ["PascalCase", "UPPER_CASE"],
        },
      ],

      // Enforce small methods (max 70 lines, excluding blanks and comments)
      "max-lines-per-function": [
        "warn",
        { max: 70, skipBlankLines: true, skipComments: true },
      ],

      // Enforce max 3 levels of nesting
      "max-depth": ["error", 3],

      // Type safety
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-floating-promises": "error",

      // General best practices
      "prefer-const": "error",
      "no-console": "warn",
    },
  },
];
