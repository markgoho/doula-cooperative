# GEMINI.md

This file provides guidance to Gemini CLI when working with code in this repository.

## Project Overview

The Rochester Doula Cooperative platform is a monorepo containing three interconnected applications:

1. **Hugo Static Site** (`/hugo`) - Public-facing website (doulacooperative.com)
2. **Firebase Functions** (`/functions`) - Serverless backend for user management and integrations
3. **Angular Members Portal** (`/members`) - Member dashboard and profile management

**Tech Stack:** Firebase (Functions, Firestore, Auth), Hugo, Angular, TypeScript, SCSS, Bun

## Package Manager

**IMPORTANT:** This project uses **Bun** (not npm, yarn, or pnpm) for all package management and script execution:

```bash
bun install        # Install dependencies
bun run <script>   # Run scripts
bun test           # Run tests
```

The only exception is the `functions/` directory, which uses npm due to Firebase Functions requirements.

## Development Workflow

### Starting All Services

From the repository root:

```bash
bun start   # Starts emulators, functions watch, Angular dev server, and Hugo server
```

This runs four services concurrently:

- Firebase Emulators (Auth: 9099, Firestore: 8080, Functions: 5001)
- Functions TypeScript watch (compiles on changes)
- Angular dev server (http://localhost:4200)
- Hugo dev server (http://localhost:1313)

**IMPORTANT:** Assume services are already running. Do not attempt to start them unless explicitly requested.

### Starting Individual Services

```bash
# Hugo development
bun run hugo:dev        # Hugo server with drafts at localhost:1313

# Angular development
bun run angular:start   # Angular dev server at localhost:4200

# Firebase emulators
bun run emulators:start      # Start with seed data
bun run emulators:export     # Export current state

# Functions development
bun run functions:start      # TypeScript watch mode
```

### Build Commands

```bash
# Hugo build
bun run build             # Production build with minification
bun run build:local       # Local build without minification
bun run index             # Build search index with pagefind
bun run build:search      # Build site + search index

# Angular build
cd members && bun run build

# Functions build
cd functions && npm run build
```

### Testing

```bash
# Functions tests (use Bun from functions directory)
cd functions && bun test
cd functions && bun test test/claim-profile.test.ts  # Single file

# Angular tests (use Bun from members directory)
cd members && bun test
cd members && bun test --watch=false  # Run once
cd members && bun vitest run src/app/header/header.spec.ts  # Single file
```

**CRITICAL:** ALL tests must be run from their respective directories (`functions/` or `members/`). Tests will fail if run from root.

### Linting

```bash
# Lint everything from root
bun run lint        # ESLint for TypeScript/JavaScript
bun run lint:fix    # Auto-fix lint issues
bun run format      # Prettier for all files

# Lint individual projects
cd members && bun run lint
cd functions && npm run lint
```

**IMPORTANT:** Always check for and fix lint errors after adding new code. This is required before considering work complete.

## Monorepo Architecture

### Directory Structure

```
/
├── functions/           # Firebase Functions (Node.js, npm)
│   ├── src/            # TypeScript source
│   ├── lib/            # Compiled JavaScript (git-ignored)
│   ├── test/           # Bun test files
│   └── GEMINI.md       # Functions-specific guidance
├── hugo/               # Hugo static site
│   ├── content/        # Markdown content
│   ├── layouts/        # Go templates
│   ├── assets/         # SCSS, TypeScript, images
│   ├── public/         # Built site (git-ignored)
│   └── GEMINI.md       # Hugo-specific guidance
├── members/            # Angular application
│   ├── src/app/        # Components and services
│   ├── dist/           # Built app (git-ignored)
│   └── GEMINI.md       # Angular-specific guidance
├── emulator-seed-data/ # Firebase emulator test data
└── package.json        # Root package.json (Bun)
```

### Key Integration Points

**Hugo ↔ Functions:**

- Form submissions POST to Firebase Functions via rewrites (`/api/contact-us-form`, `/api/doula-match-form`)
- Functions are exposed through Firebase Hosting rewrites (configured in firebase.json)

**Angular ↔ Functions:**

- Angular calls Functions via `@angular/fire/functions` (`claimProfile`, `readProfile`)
- Angular reads from Firestore `members` collection
- Automatic emulator connection in development mode

**Functions ↔ GitHub:**

- `readProfile` function fetches Hugo content from GitHub using Octokit
- Reads markdown files and images from `hugo/content/doulas/` via GitHub API

### Firebase Configuration

**Emulator Ports:**

- Auth: 9099
- Firestore: 8080
- Functions: 5001
- UI: Auto-assigned

**Firestore Collections:**

- `members` - User profiles and membership data (keyed by Firebase Auth UID)
- `import` or `migrated_users_import` - Pre-imported profiles (keyed by email, deleted after claim)
- `messages` - Contact form submissions
- `matchRequests` - Doula match requests

**Hosting Targets:**

- `main-site` - Hugo static site (doula-cooperative)
- `members-site` - Angular app (doula-coop-members)

## TypeScript Configuration

### Root tsconfig.json

Applies to root-level TypeScript files and Hugo assets:

- `target: "ESNext"`
- `module: "Preserve"`
- `moduleResolution: "bundler"`
- `strict: true`
- Includes: `*.ts`, `functions/src/**/*.ts`, `hugo/assets/ts/**/*.ts`
- Excludes: `members/`, `functions/node_modules/`, build directories

### Project-Specific Configs

- **functions/tsconfig.json** - Node.js 20, CommonJS output to `lib/`
- **members/tsconfig.json** - Angular-specific, zoneless change detection

## ESLint Configuration

### Root eslint.config.js

Applies to root and Hugo TypeScript files:

- `@eslint/js` + `typescript-eslint` (strict and stylistic)
- `eslint-plugin-unicorn` for code quality
- Ignores: `members/`, `functions/lib/`, `hugo/public/`, build artifacts

**Key customizations:**

- `unicorn/consistent-function-scoping.checkArrowFunctions: false` - Allows arrow functions in signals
- `unicorn/no-useless-undefined.checkArguments: false` - Allows explicit undefined

### Project-Specific Configs

- **functions/** - Uses root config with Node.js globals, separate config for tests
- **members/.eslintrc.json** - Angular ESLint with component-specific rules

## Important Patterns

### Lazy Function Imports

Firebase Functions use lazy imports (dynamic imports) for cold start optimization:

```typescript
// src/index.ts
export const contactUsForm = onRequest((request, response) =>
  import("./contact-us-form/handler.js").then(m =>
    m.handler(request, response),
  ),
);
```

All function handlers are exported from `src/index.ts` with this pattern.

### Collection Name Constants

**ALWAYS** use collection constants from `functions/src/constants/collections.ts`:

```typescript
// GOOD
import { MEMBERS_COLLECTION } from "./constants/collections.js";
const doc = db.collection(MEMBERS_COLLECTION).doc(uid);

// BAD
const doc = db.collection("members").doc(uid);
```

### Testing Patterns

**Functions tests:**

- Use Bun test runner with `firebase-functions-test`
- Setup function returns test dependencies
- Arrange-Act-Assert structure
- Explicit cleanup in `afterAll` hooks

**Angular tests:**

- Use @testing-library/angular with Vitest
- Setup function with semantic boolean options (`isAuthenticated`, `isEmailVerified`)
- Mock services use signals for reactive properties
- ALWAYS assert visibility: `expect(element).toBeVisible()` not `toBeTruthy()`

### Object Lookup Over Switch

Prefer object lookup maps instead of switch statements:

```typescript
// GOOD
const messages = {
  "auth/user-not-found": "No user found",
  "auth/wrong-password": "Invalid password",
};
return messages[code] ?? "An error occurred";

// AVOID
switch (code) {
  case "auth/user-not-found":
    return "No user found";
  // ...
}
```

## Git Workflow

**Main branch:** `trunk` (not `main` or `master`)

**When creating pull requests:**

- Target branch: `trunk`
- Base commands from the repository root

## Project-Specific Documentation

For detailed information about each sub-project, see:

- **Hugo:** `hugo/GEMINI.md` - Template system, content structure, SCSS architecture
- **Functions:** `functions/GEMINI.md` - Function types, external integrations, secret management
- **Members:** `members/GEMINI.md` - Angular patterns, routing, services, testing guidelines

These files contain comprehensive architecture details that are not repeated here.
