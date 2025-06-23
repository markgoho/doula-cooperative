import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";

export default tseslint.config(
	{
		// config with just ignores is separate object
		ignores: [
			"node_modules/**",
			"dist/**",
			"build/**",
			".firebase/**",
			"firebase-debug.log",
			"firestore-debug.log",
			"functions/lib/**",
		],
	},
	eslint.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	unicorn.configs.recommended,
	{
		plugins: {
			unicorn,
		},
	},
	{
		files: ["**/*.{js,jsx,ts,tsx}"],
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
	},
	{
		files: ["**/*.{js,jsx}"],
		rules: {
			// Disable TypeScript-specific rules for JS files
			...tseslint.configs.disableTypeChecked.rules,
		},
	},
);
