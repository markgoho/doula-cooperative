import eslint from "@eslint/js";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    // config with just ignores is separate object
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".firebase/**",
      ".angular/**",
      "members/**",
      "firebase-debug.log",
      "firestore-debug.log",
      "functions/lib/**",
      "hugo/public/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    plugins: {
      unicorn,
    },
    rules: {
      ...unicorn.configs.recommended.rules,
      // Allow arrow functions in computed signals and similar reactive contexts
      "unicorn/consistent-function-scoping": [
        "error",
        {
          checkArrowFunctions: false,
        },
      ],
      "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
          allowBoolean: true,
        },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ignores: [".angular/**", "members/.angular/**", "eslint.config.js"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // {
  // 	files: ["eslint.config.js"],
  // 	rules: {
  // 		"unicorn/filename-case": ["error", { case: "kebabCase" }],
  // 	},
  // },
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
    rules: {
      // Allow bracket notation for index signature properties (e.g., process.env["KEY"])
      "@typescript-eslint/dot-notation": [
        "error",
        { allowIndexSignaturePropertyAccess: true },
      ],
    },
  },
  {
    files: ["functions/src/**/*.test.ts", "functions/src/test-utils/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "functions/tsconfig.test.json",
      },
    },
  },
  {
    files: ["members/**/*.spec.ts", "members/**/*.integration.spec.ts"],
    languageOptions: {
      parserOptions: {
        project: "members/tsconfig.spec.json",
      },
    },
  },
  {
    files: ["members/e2e/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "members/tsconfig.e2e.json",
      },
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    ignores: [".angular/**", "members/.angular/**", "**/.angular/**"],
    rules: {
      // Disable TypeScript-specific rules for JS files
      ...tseslint.configs.disableTypeChecked.rules,
    },
  },
]);
