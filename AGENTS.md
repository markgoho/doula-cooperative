# AGENTS.md

**Generated:** 2026-02-01 13:43:53 EST  
**Commit:** 2258f9f  
**Branch:** trunk

## OVERVIEW

Monorepo: Hugo static site, Firebase Functions (Elysia-based APIs), Angular members portal. Tech: Firebase (Functions, Firestore, Auth), Hugo, Angular 21, TypeScript, SCSS, Bun.

## STRUCTURE

```
./
├── functions/        # Firebase Functions (Elysia APIs) - npm for build, bun for tests
├── members/          # Angular members portal - Bun, signals, zoneless
├── hugo/             # Static site - Hugo extended, SCSS, doula profiles
├── docs/             # Delivery notes, Stripe setup
└── emulator-seed-data/  # Firebase emulator test data
```

## WHERE TO LOOK

| Task                      | Location                                                         | Notes                                                  |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| Add Firebase API endpoint | `functions/src/`                                                 | Elysia apps, lazy-loaded from `functions/src/index.ts` |
| Auth / member management  | `functions/src/shared-api`, `functions/src/members-api`          | Reusable auth, Firestore services                      |
| Admin features            | `members/src/app/admin`, `functions/src/admin-*-api`             | Angular admin UI + backend APIs                        |
| Profile create/edit       | `members/src/app/create-profile`, `members/src/app/edit-profile` | Reuses `shared/profile-form` utilities                 |
| Static site content       | `hugo/content/`                                                  | Doula profiles in `doulas/`, markdown pages            |
| Email / webhooks          | `functions/src/forms-api`, `functions/src/stripe-webhook-api`    | Mailgun integration, Stripe events                     |
| Test utilities            | `functions/src/test-utils`, `members/src/test-setup.ts`          | Mock factories, Testing Library setup                  |

## COMMANDS

```bash
# Root
bun install                # Install all dependencies
bun run start              # Start all services (emulators, functions watch, Angular, Hugo)
bun run lint               # Lint entire monorepo
bun run format             # Format with Prettier

# Functions (uses npm for build/lint, bun for tests)
cd functions && npm run build              # Build TypeScript
cd functions && npm run build:watch        # Watch mode
cd functions && bun test                   # Run all tests
cd functions && npm run lint               # ESLint

# Members (uses bun)
cd members && bun start                    # Dev server (localhost:4200)
cd members && bun run build                # Production build
cd members && bun test                     # Unit tests (watch mode)
cd members && bun run e2e                  # Playwright E2E tests

# Hugo (uses bun)
cd hugo && hugo server --disableFastRender -D  # Dev server (localhost:1313)
cd hugo && hugo --minify                       # Production build
```

## CONVENTIONS

### Package Manager

- **Functions:** npm for build/lint/deploy, bun for tests
- **Everywhere else:** Bun (root, members, Hugo scripts)
- Mixed toolchain intentional (Firebase deploy expects npm-based builds)

### TypeScript Strictness

- `tsconfig.base.json` enforces strict + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- Use `import type { Type }` for types only
- Resolve ALL type errors before completion

### Formatting

- **Root:** Double quotes, printWidth 80, Prettier plugins: organize-imports, go-template
- **Members:** Single quotes (overridden in package.json), printWidth 100
- **EditorConfig:** Single quotes for TS (conflicts with root Prettier - use per-package settings)

### Firebase Functions

- Entry: `functions/src/index.ts` exports all functions with lazy dynamic imports
- Pattern: Each function exports Elysia app from `*-api/app.ts`, wrapped by `handler.ts`
- Secrets: Declare in function config `secrets: ["SECRET_NAME"]`, access via `process.env.SECRET_NAME`
- NEVER hardcode collection names - use constants from `functions/src/collections`

### Angular

- Standalone components, zoneless change detection (`provideZonelessChangeDetection`)
- Use `inject()` for DI, signals for reactive state, `ChangeDetection.OnPush` on all components
- Template control flow: `@if/@for` (NOT `*ngIf/*ngFor`)
- Component naming: PascalCase without "Component" suffix (e.g., `Header`, not `HeaderComponent`)

## ANTI-PATTERNS (THIS PROJECT)

- **DO NOT** hardcode collection names - use `functions/src/constants/collections.ts`
- **DO NOT** mix test and live Stripe credentials
- **DO NOT** test service method calls in unit tests - test user-visible outcomes
- **NEVER** use `toBeTruthy()`/`toBeFalsy()` on DOM elements - use `toBeVisible()` or `.not.toBeInTheDocument()`
- **NEVER** use Firebase emulators in new tests (except Auth emulator for E2E)
- **NEVER** commit secrets (`sk_test_*`, `sk_live_*`) - use GitHub secrets and `.env` files
- **NEVER** use `import * as` - use destructuring `import { method }`

## UNIQUE STYLES

- **Elysia inside Firebase Functions:** Unconventional but deliberate - lazy-loaded for cold-start optimization
- **Committed build artifacts:** `functions/lib/` is committed alongside `src/` - intentional for deployment (NOT ideal, consider .gitignore)
- **TypeScript .js extensions in imports:** `import "./file.js"` in TS source - required for ESM `"type":"module"` setup
- **Multi-toolchain:** Bun + npm in same monorepo - functions uses npm for Firebase deploy compatibility

## NOTES

### Before Starting New Work

**ALWAYS pull the latest `trunk` before starting any new feature or fix.** This project commits directly to `trunk`, so other work (including other AI sessions) may have landed since your last pull. Starting from stale state causes painful merge conflicts during push.

```bash
git pull --rebase origin trunk
```

### Testing Requirements

- **Functions:** ALL route logic files MUST have tests covering auth/validation/success/errors
- **Members:** Admin features MUST have E2E tests (Playwright)
- **Test pattern:** Use `setup()` function with semantic options, signal-based mocks, accessibility-first queries

### Build Artifacts

- `functions/lib/` contains compiled JS - edit `functions/src/` and rebuild with `npm run build`
- PR previews deploy hosting only (NOT functions) - Stripe webhooks hit production unless manually deployed

### CI/CD

- Uses custom GHCR container image (`ghcr.io/${{ github.repository }}:trunk`)
- Docker image built by `.github/workflows/docker-image.yml` on trunk pushes
- Hugo deployment triggers profile-deployment-webhook with `DEPLOY_WEBHOOK_SECRET`

### Port Reference

- Hugo: `localhost:1313`
- Angular: `localhost:4200`
- Firestore emulator: `localhost:8090`
- Auth emulator: `localhost:9099`
- Functions emulator: `localhost:5001`
