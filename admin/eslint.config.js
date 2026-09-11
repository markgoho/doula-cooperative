// @ts-check
import eslint from '@eslint/js';
import angular from 'angular-eslint';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    files: ['**/*.ts'],
    ...eslint.configs.recommended,
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  ...tseslint.configs.stylistic.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  ...angular.configs.tsRecommended.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      unicorn,
    },
    processor: angular.processInlineTemplates,
    rules: {
      ...unicorn.configs.recommended.rules,
      // Allow arrow functions in computed signals and similar reactive contexts
      'unicorn/consistent-function-scoping': [
        'error',
        {
          checkArrowFunctions: false,
        },
      ],
      'unicorn/no-useless-undefined': ['error', { checkArguments: false }],
      // Angular has its own member ordering conventions (inject → signals → lifecycle)
      'unicorn/consistent-class-member-order': 'off',
      // destroyRef = inject(DestroyRef) is the standard Angular DI pattern
      'unicorn/no-non-function-verb-prefix': 'off',
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: ['element', 'attribute'],
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    // False positive: vi.fn(function (this: Type) {...}) is a valid typed function context
    files: ['**/*.spec.ts', '**/*.integration.spec.ts'],
    rules: {
      'unicorn/no-this-outside-of-class': 'off',
    },
  },
  {
    // Angular lazy-loaded route configs must use .then(m => m.Component) — cannot await
    // inside a Routes array literal, so prefer-await is a false positive here.
    files: ['**/*.routes.ts'],
    rules: {
      'unicorn/prefer-await': 'off',
    },
  },
  ...angular.configs.templateRecommended.map((config) => ({
    ...config,
    files: ['**/*.html'],
  })),
  ...angular.configs.templateAccessibility.map((config) => ({
    ...config,
    files: ['**/*.html'],
  })),
]);
