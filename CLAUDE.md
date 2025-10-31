# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tech Stack:** Firebase (Functions, Firestore, Auth), Hugo (static site), Angular (members area), TypeScript, SCSS, Bun

**Architecture:**
- `/functions/` - Firebase Cloud Functions (user management, profile operations, email verification)
- `/hugo/` - Static website built with Hugo (doula directory, content pages) - localhost:1313
- `/members/` - Angular application (member dashboard) - localhost:4200
- `/emulator-seed-data/` - Firebase emulator data for local development

## Development Commands

### Root Project
```bash
# Install dependencies
bun install

# Start all services (emulators, functions, angular, hugo)
bun start

# Linting
bun run lint
bun run lint:fix

# Hugo static site
bun run hugo:dev          # Dev server
bun run build             # Production build
bun run build:search      # Build with search indexing

# Firebase emulators
bun run emulators:start   # Start with seed data
bun run emulators:export  # Export emulator data
bun run emulators:test    # Test project emulators
```

### Functions (`/functions`)
```bash
cd functions

# Build and type checking
npm run build             # Compile TypeScript
npm run build:watch       # Watch mode
npm run typecheck         # Type check without emitting
npm run typecheck:tests   # Type check test files

# Testing
bun test                  # Run all tests
bun test --include test/specific-file.test.ts  # Single test file

# Linting
npm run lint
```

### Members App (`/members`)
```bash
cd members

# Development
bun start                 # Dev server (ng serve)

# Testing
bun run test              # Run all tests
bun run test --include src/app/path/file.spec.ts  # Single test file

# Build and linting
bun run build
bun run lint
```

## Architecture Patterns

### Firebase Functions (`/functions`)

**Lazy Loading Pattern:**
All functions in `src/index.ts` use lazy loading to reduce cold start times:

```typescript
export const myFunction = onRequest(async (request, response) => {
  const { handleMyFunction } = await import("./my-feature/handler.js");
  await handleMyFunction(request, response);
});
```

**Collection Constants:**
Always use constants from `src/constants/collections.ts` instead of hardcoding collection names:
```typescript
import { MEMBERS_COLLECTION } from "../constants/collections";
// Use MEMBERS_COLLECTION not "members"
```

**Firestore Access:**
```typescript
import { getFirestore } from "firebase-admin/firestore";
```

**Idempotency:**
Keep functions idempotent unless they involve setting timestamps.

### Angular Application (`/members`)

**Component Architecture:**
- Use `inject()` for dependency injection (not constructor)
- Use signal-based APIs whenever possible
- Always use `ChangeDetection.OnPush` for new components
- `standalone: true` is default (no need to add)
- Avoid subscribing to observables in class; use async pipe in templates
- Components never access Firebase directly - always use services
- Use signals for class properties

**Router Configuration:**
- `withComponentInputBinding()` is enabled - use this to access query params as component inputs

**Template Syntax:**
- Use newer control flow: `@if`, `@for`, etc.
- Don't unnecessarily nest elements; use styling instead

**Styling:**
- Use modern CSS with intrinsic design principles
- Use CSS custom properties, container queries, responsive units (rem not px)
- Use color/spacing tokens instead of hard-coded values
- Minimize SCSS-specific functionality; prefer native CSS

### TypeScript Conventions

- Prefer destructuring imports: `import { method } from 'package';`
- Use object lookup maps instead of switch statements when possible
- Disabling eslint rules is last resort - add comment explaining why if necessary
- Always check for lint errors after adding new code

### Testing

**Functions Tests (`functions/test/*.test.ts`):**
- One assertion per test
- Use setup and cleanup functions
- Import from `../src/index.ts` for callable functions and wrap with `test.wrap()`
- For HTTP functions: import from `index.ts` but call directly (no `test.wrap()`)
- For trigger functions: use `initializeFirestoreTriggerTest()` for handlers with external dependencies
- Set `process.env.FUNCTIONS_EMULATOR = "true"` to skip external services
- Use `initializeTest()` pattern for all function types
- Always call `test.cleanup()` in `afterAll()`
- See `.cursor/rules/functions-tests.mdc` for detailed testing patterns

**Angular Tests (`members/**/*.spec.ts`):**
- Test user behavior, not implementation details
- One logical assertion per test (exceptions: related attributes on same element, visibility + content)
- Use Arrange-Act-Assert pattern
- Setup function must destructure parameters in signature with defaults
- Create `user = userEvent.setup()` in setup function and return it
- Don't test routing in unit tests (use integration tests)
- Form validation only appears when fields are both invalid AND touched
- Run tests: `bun run test` or `bun run test --include path/to/file.spec.ts`
- DO NOT import `test-providers.ts` (happens automatically)

**Integration vs Unit Tests:**
- Unit tests (`*.spec.ts`): UI states, form validation, service calls, edge cases
- Integration tests (`*.integration.spec.ts`): routing flows only, minimal tests (2-3 per flow)

### Hugo Static Site

- Built with Hugo static site generator
- Doula directory and content pages
- Development: `bun run hugo:dev`
- Build: `bun run build` (includes search indexing)

## Bun Usage

Default to Bun instead of Node.js:
- `bun <file>` instead of `node` or `ts-node`
- `bun test` instead of `jest` or `vitest`
- `bun install` instead of `npm install`
- `bun run <script>` instead of `npm run`
- Bun automatically loads `.env` (no dotenv needed)

## Important Notes

- Applications are already running during development; don't restart them unnecessarily
- Check for lint errors after adding new code and fix before completing work
- Be concise in responses
