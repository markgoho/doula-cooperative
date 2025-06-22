import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import unicorn from "eslint-plugin-unicorn";

export default [
  eslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      unicorn,
    },
    rules: {
      // Unicorn recommended rules
      ...unicorn.configs.recommended.rules,

      // Additional rules for better code quality
      "no-console": "warn",
      "no-debugger": "error",
      "no-unused-vars": "off", // Disabled in favor of @typescript-eslint version
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-inferrable-types": "error",

      // Import organization (similar to Biome's organizeImports)
      "sort-imports": [
        "error",
        {
          ignoreCase: false,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
        },
      ],

      // Some unicorn rules adjustments for better compatibility
      "unicorn/prevent-abbreviations": "off", // Can be too aggressive
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-null": "off", // Allow null usage
      "unicorn/no-empty-file": "off", // Allow empty files (useful for placeholder files)
    },
  },
  {
    files: ["functions/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        // Node.js globals for Firebase Functions
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
      },
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    rules: {
      // Disable TypeScript-specific rules for JS files
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".firebase/**",
      "firebase-debug.log",
      "firestore-debug.log",
    ],
  },
];
