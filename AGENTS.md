# AGENTS.md

## Project Overview

Monorepo with three apps: Hugo static site (`/hugo`), Firebase Functions (`/functions`), Angular members portal (`/members`). Tech stack: Firebase (Functions, Firestore, Auth), Hugo, Angular 21, TypeScript, SCSS, Bun.

**Ports:**

- Hugo: `localhost:1313`
- Angular: `localhost:4200`
- Firebase Emulators: Firestore `localhost:8080`, Auth `localhost:9099`, Functions `localhost:5001`

## Build/Lint/Test Commands

### Functions (uses npm, NOT bun)

```bash
cd functions
npm run build              # Build TypeScript
npm run build:watch        # Watch mode
npm run lint               # ESLint
bun test                   # Run all tests
bun test src/path/to/file.test.ts  # Single test
```

### Members (uses bun)

```bash
cd members
bun install                # Install dependencies
bun start                  # Dev server
bun run build              # Production build
bun run lint               # ESLint
bun test                   # All tests (watch mode)
bun test --watch=false     # All tests (single run)
ng test --include="**/header.spec.ts" --watch=false  # Single test
bun run e2e                # End-to-end tests (Playwright)
```

### Hugo (uses bun)

```bash
cd hugo
hugo server --disableFastRender -D  # Dev server
hugo                                 # Build static site
hugo --minify                        # Production build
```

### Root (uses bun)

```bash
bun install                # Install all dependencies
bun run lint               # Lint entire monorepo
bun run lint:fix           # Auto-fix lint issues
bun run format             # Format with Prettier
bun run start              # Start all services concurrently
```

## Code Style Guidelines

### Package Manager

- **Functions:** Use `npm` for build/lint, `bun` for tests/scripts
- **Everywhere else:** Use `bun` (not npm/yarn/pnpm)
- Bun automatically loads `.env` files

### TypeScript

- **Strict mode enabled:** Resolve ALL type errors before completion
- **Imports:** Use destructuring `import { method } from 'package'`, NOT `import * as`
- **Type imports:** Use `import type { Type }` for types only (verbatimModuleSyntax enabled)
- **Naming:** camelCase for variables/functions, PascalCase for classes/types/components
- **No unused:** Fail on unused locals and parameters
- **Exactness:** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled

### Prettier Configuration

- **Semicolons:** Always use (root uses `;`, members uses single quotes)
- **Quotes:** Double quotes in root, single quotes in members
- **Trailing commas:** Always
- **Tab width:** 2 spaces
- **Print width:** 80 (root), 100 (members)
- **Arrow parens:** Avoid
- **Plugins:** organize-imports (auto-sorts), go-template (Hugo)

### ESLint Rules

- Uses `typescript-eslint` strict + stylistic configs
- `eslint-plugin-unicorn` for code quality
- `unicorn/consistent-function-scoping.checkArrowFunctions: false` - Allows arrow functions in signals/computed
- `unicorn/no-useless-undefined.checkArguments: false` - Allows explicit undefined
- `unicorn/no-null: off` in test files (for SIFERS pattern)

### Error Handling

- Use object lookup maps over switch statements
- Throw errors with descriptive messages
- Map technical errors to user-friendly messages (see `AUTH_ERROR_MESSAGES`)

## Firebase Functions Patterns

### Structure & Lazy Loading

- **Entry point:** `functions/src/index.ts` exports all functions
- **CRITICAL:** Always lazy-load function implementations:

```typescript
export const myFunction = functions.https.onRequest(async (req, res) => {
  const { handler } = await import("./my-function/handler");
  await handler(req, res);
});
```

### Collections

- **MUST** use collection constants from `functions/src/constants/collections.ts`
- Examples: `MEMBERS_COLLECTION`, `MESSAGES_COLLECTION`
- NEVER hardcode collection names like `"members"`

### Key Collections

- `members` - Primary user collection (uid, email, membershipActive, stripeCustomerId)
- `messages` - Contact form submissions
- `matchRequests` - Doula match form submissions
- `migrated_users_import` - Pre-imported profiles (deleted after claim)
- `processed_stripe_events` - Webhook idempotency tracking

### Best Practices

- Keep functions idempotent unless involving timestamps
- Use `getFirestore()` from `firebase-admin/firestore`
- Declare secrets in function config: `secrets: ["SECRET_NAME"]`
- Access via `process.env.SECRET_NAME`

## Angular Patterns

### Component Structure

- **Standalone components:** Default (no need to specify `standalone: true`)
- **Dependency injection:** Use `inject()` function, NOT constructor injection
- **Change detection:** `ChangeDetection.OnPush` for all components
- **Naming:** PascalCase without "Component" suffix (e.g., `Header` not `HeaderComponent`)
- **NO CommonModule imports:** Import only what you need explicitly

### Reactivity

- **Signals:** Primary reactive primitive - use `signal()`, `computed()`, `toSignal()`
- **NO subscriptions in components:** Use `async` pipe in templates instead
- **Effects:** Rare - prefer reactive templates
- **Zoneless:** App uses `provideZonelessChangeDetection()` - no Zone.js

### Templates

- Use newer control flow: `@if`, `@for`, `@else`, NOT `*ngIf`/`*ngFor`
- Avoid unnecessary element nesting - use CSS for layout
- Test with accessibility-first queries: `screen.getByRole()`

### Routing

- `withComponentInputBinding()` enabled - query params bind to component inputs
- Never access Firebase directly from components - always use services
- Protected routes use `canActivate` guards from `@angular/fire/auth-guard`

### Styling (SCSS)

- Use modern CSS: custom properties, container queries, rem units
- Prefer CSS tokens over hardcoded values (colors, spacing, font-weights)
- Follow intrinsic design principles
- Avoid SCSS-specific features unless necessary

### Hugo Templates

- Page-specific CSS: Use `{{ define "head-styles" }}` pattern with inlined SCSS
- Verify changes with Playwright MCP server browsing

## Testing Guidelines

### Functions Tests (Bun Test)

- **File pattern:** `*.test.ts` in `functions/src/`
- **One assertion per test** - split multiple checks into separate tests
- **Setup function (SIFERS pattern):** All "Arrange" logic in setup, export for tests

```typescript
function setup({
  email = "test@example.com",
  shouldFail = false,
}: SetupOptions = {}) {
  return { email, mockData: {...} };
}
```

### Initialization Patterns

**All function types:**

```typescript
import { initializeTest } from "../src/test-utils/test-setup";
const test = initializeTest();
afterAll(() => test.cleanup());
```

**Callable functions:** Import from `index.ts`, use `test.wrap()`

```typescript
import { claimProfile } from "../src";
const wrapped = test.wrap(claimProfile);
```

**HTTP functions:** Import from `index.ts`, call directly (NO `test.wrap()`)

```typescript
import { contactUsForm } from "../src";
await contactUsForm(mockRequest, mockResponse);
```

**Firestore triggers (with dependencies):** Use `@firebase/rules-unit-testing`

```typescript
import { initializeFirestoreTriggerTest } from "../src/test-utils/test-setup";
let testEnvironment = await initializeFirestoreTriggerTest();
// All operations inside withSecurityRulesDisabled()
await testEnvironment.withSecurityRulesDisabled(async context => {
  // test logic here
});
```

### Trigger Isolation Warning

- HTTP functions writing to Firestore trigger `onDocumentCreated` automatically
- Use flexible assertions: `expect(typeof data.sent).toBe("boolean")` NOT `toBe(false)`
- Or test triggers separately in dedicated test files

### Shared Test Utilities

- `createMockCallableRequest()` - Mock callable request with auth
- `createMockResponse()` - Mock HTTP response
- `getDocumentByEmail()`, `cleanupTestDocumentsByEmail()` - Firestore helpers
- `assertSuccessStatus()`, `assertCorsHeaders()` - Shared assertions

### Members Tests (Vitest + Testing Library)

- **File patterns:** `*.spec.ts` (unit), `*.integration.spec.ts` (routing)
- **Framework:** `@testing-library/angular` with `@testing-library/jest-dom/vitest` matchers
- **Run from members directory** - tests fail from root

### Unit Test Principles

- Test user behavior, NOT implementation details
- Follow Arrange-Act-Assert pattern
- **CRITICAL:** ONE logical assertion per test (exceptions: multiple attributes of same element)
- NEVER test service method calls - test user-visible outcomes

### Setup Function Requirements

**CRITICAL pattern:**

```typescript
interface SetupOptions {
  isAuthenticated?: boolean;
  isEmailVerified?: boolean;
}

async function setup({
  isAuthenticated = false,
  isEmailVerified = false,
}: SetupOptions = {}) {
  const mockAuthService = {
    user: signal(isAuthenticated ? mockUser : null),
    emailVerified: signal(isEmailVerified),
  };

  const view = await render(Component, {
    providers: [{ provide: AuthService, useValue: mockAuthService }],
  });

  const user = userEvent.setup();
  return { view, user, mockAuthService };
}
```

- Destructure parameters in signature with defaults
- Use semantic options (what happens) not implementation details (how)
- Return `user` from `userEvent.setup()`
- Only include properties the component uses

### Assertions

- **ALWAYS:** `expect(element).toBeVisible()` or `.not.toBeInTheDocument()`
- **NEVER:** `toBeTruthy()` or `toBeFalsy()` on DOM elements
- Use `waitFor()` for async DOM operations
- Use `screen.getByRole()` for accessibility-first queries

### Mock Services

- Use `signal()` for reactive properties: `user: signal(mockUser)`
- Use `vi.fn().mockResolvedValue()` for async methods
- Use `vi.fn().mockImplementation()` for parameter-dependent behavior

### Integration Tests

- Test routing flows ONLY - "which page after success/failure?"
- NO testing of error messages, form validation, or service calls
- Use `provideRouter()` with mock route components
- Navigate: `await router.navigateByUrl()` + `fixture.detectChanges()`

## Key Integration Points

- Hugo forms POST to Firebase Functions via rewrites (`/api/contact-us-form`, `/api/doula-match-form`)
- Angular calls Functions via `@angular/fire/functions` (`claimProfile`, `readProfile`)
- Functions read Hugo content from GitHub using Octokit
- Firebase emulators auto-connect in development mode (`isDevMode()`)

## External Services

- **Stripe:** Webhook for `checkout.session.completed`, creates users after payment
- **Mailgun:** Email triggers for contact/match forms
- **GitHub:** Octokit reads from `hugo/content/doulas/` directory

## Cursor Rules Summary

All rules in `.cursor/rules/` apply to specific file patterns:

- **project.mdc** - Be concise, apps already running
- **use-bun.mdc** - Prefer Bun APIs, no Express/Vite
- **typescript-errors.mdc** - Always resolve errors before completion
- **firebase-functions.mdc** - Collection constants, idempotent functions
- **lazy-load-functions.mdc** - Async imports in `index.ts`
- **functions-tests.mdc** - Setup pattern, trigger isolation, test utilities
- **angular-component.mdc** - inject(), signals, OnPush, NO CommonModule
- **angular-template.mdc** - @if/@for syntax, signals, no nesting
- **angular-styles.mdc** - Modern CSS, tokens, intrinsic design
- **angular-spec.mdc** - Setup pattern, one assertion, accessibility queries
- **modern-css.mdc** - Custom properties, container queries, rem units, tokens
- **page-specific-css.mdc** - Hugo head-styles pattern
- **use-playwright-to-verify.mdc** - Verify Hugo changes with Playwright

## Git Hooks

Pre-commit hook auto-configured via `bun install` (runs Prettier on staged files).
