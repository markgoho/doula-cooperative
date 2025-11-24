# AGENTS.md

## Project Overview

Monorepo with three apps: Hugo static site (`/hugo`), Firebase Functions (`/functions`), Angular members portal (`/members`). Tech stack: Firebase, Hugo, Angular, TypeScript, SCSS, Bun.

## Build/Lint/Test Commands

- **Single test:** `cd functions && bun test test/claim-profile.test.ts` or `cd members && bun vitest run src/app/header/header.spec.ts`
- **All tests:** `cd functions && bun test` or `cd members && bun test`
- **Lint:** `bun run lint` (root) or `cd members && bun run lint` or `cd functions && npm run lint`
- **Build:** `bun run build` (Hugo) or `cd members && bun run build` or `cd functions && npm run build`

## Code Style Guidelines

- **Imports:** Prefer destructuring imports (`import { method } from 'package'`)
- **Types:** Strict TypeScript enabled, resolve errors before completion
- **Naming:** camelCase for variables/functions, PascalCase for classes/types
- **Error handling:** Use object lookup maps over switch statements
- **Firebase:** Use collection constants from `functions/src/collections/index.ts`
- **Angular:** Use `inject()` for dependencies, signals for reactive properties, `ChangeDetection.OnPush`
- **Testing:** One assertion per test, setup/cleanup functions, assert visibility with `toBeVisible()`

## Package Manager

**IMPORTANT:** Use **Bun** for all operations except `functions/` (uses npm). Run from correct directory - tests fail from root.

## Key Integration Points

- Hugo forms POST to Firebase Functions via rewrites (`/api/contact-us-form`, `/api/doula-match-form`)
- Angular calls Functions via `@angular/fire/functions` (`claimProfile`, `readProfile`)
- Functions read Hugo content from GitHub using Octokit

## Cursor Rules

Follow all rules in `.cursor/rules/` including:

- `typescript.mdc` - Import patterns, lint error resolution
- `firebase-functions.mdc` - Collection constants, idempotent functions
- `angular-component.mdc` - Signal-based APIs, standalone components
- `functions-tests.mdc` - Test isolation, trigger handling
- `use-bun.mdc` - Bun over npm/yarn for all operations
