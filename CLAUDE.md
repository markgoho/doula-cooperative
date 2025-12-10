# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-platform doula cooperative website:

- **Firebase Backend**: Cloud Functions (TypeScript), Firestore, Authentication
- **Hugo Static Site**: Main public website with doula directory
- **Angular Members App**: Member dashboard and management
- **Bun**: Primary package manager

## Development Commands

```bash
# Start all services (emulators, functions, Angular, Hugo)
bun start

# Individual services
bun run hugo:dev              # Hugo dev server (localhost:1313)
bun run angular:start         # Angular dev server (localhost:4200)
bun run emulators:start       # Firebase emulators (Firestore:8080, Auth:9099, Functions:5001)
bun run functions:start       # Watch mode for TypeScript compilation

# Build commands
bun run build                 # Hugo production build
bun run build:search          # Build with Pagefind search index
cd members && bun run build   # Angular production build
cd functions && bun run build # Compile TypeScript functions

# Linting and formatting
bun run lint                  # Run ESLint
bun run lint:fix              # Auto-fix ESLint issues
bun run format                # Format with Prettier

# Testing
cd members && bun run test                              # Run all Angular tests
cd members && bun run test --include path/to/spec.ts    # Run specific test
cd functions && bun test                                # Run Firebase Functions tests

```

## End-to-end testing

Use Playwright MCP server for browser automation testing

## Architecture

### Firebase Functions (`/functions/`)

**Lazy-Loading Pattern**: All functions use dynamic imports to reduce cold start times:

```typescript
export const myFunction = onRequest(async (request, response) => {
  const { handleMyFunction } = await import("./my-function/handler.js");
  await handleMyFunction(request, response);
});
```

**Function Types**:

- **HTTP Functions** (`onRequest`): `contactUsForm`, `doulaMatchForm`, `stripeWebhook`
- **Callable Functions** (`onCall`): `claimProfile`, `readProfile`, `uploadProfileImage`, `deleteProfileImage`
- **Firestore Triggers** (`onDocumentCreated`): `emailContactForm`, `emailDoulaMatch`
- **Auth Triggers**: `createMemberOnUserCreated`, `deleteMemberOnUserDeleted`

**IMPORTANT**: Always use Firebase Functions v2 imports:
```typescript
// ✅ CORRECT - Use v2 imports
import { onCall, onRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";

// ❌ WRONG - Don't use v1 imports (causes CORS issues)
import { onCall } from "firebase-functions/https";
```

**Key Patterns**:

- Always use collection constants from `src/constants/collections.ts` (never hardcode collection names)
- Use `getFirestore()` from `firebase-admin/firestore` for database access
- Functions should be idempotent unless they involve timestamps
- Handlers are in separate files (e.g., `contact-us-form/contact-us-form.ts`)

**Error Handling & Data Consistency**:

- Use custom error classes for external APIs (not string matching in catch blocks)
- When syncing between systems (Firestore + external service), throw on failure to trigger retry (ensure operations are idempotent)
- Response types must include external service sync status (e.g., `mailerliteSynced: boolean`, `warning?: string`)
- Mark cascading failures as CRITICAL severity (e.g., external API fails AND notification email fails)
- Send admin notifications for: external service failures, unexpected validation issues, production config errors

**Testing**:

- Use `initializeTest()` from `test-utils/test-setup.ts`
- HTTP functions: Import from `index.ts`, call directly (no `test.wrap()`)
- Callable functions: Import from `index.ts`, use `test.wrap()`
- Firestore triggers: Use `initializeFirestoreTriggerTest()` for handlers with external dependencies
- **All new features require tests** covering: authentication, input validation, business logic, error scenarios, and edge cases
- Security utilities (XSS prevention, auth checks) require comprehensive test coverage

### Angular Members App (`/members/`)

**Modern Angular Features**:

- Zoneless change detection (`provideZonelessChangeDetection()`)
- Standalone components (default, no need to specify)
- Signal-based APIs for reactive state
- `ChangeDetection.OnPush` for all new components

**Key Patterns**:

- Use `inject()` for dependency injection (not constructor)
- Use signals for component properties
- Avoid subscribing to observables in classes; use async pipe in templates
- Never import `CommonModule`; import only explicit modules needed
- Components never access Firebase directly; always use services
- Router has `withComponentInputBinding()` enabled for query params
- **Use `resource` API for reactive async data loading** - See `members/RESOURCE_PATTERN.md` for detailed guide
  - Replace manual loading/caching with declarative resource pattern
  - Automatic reactivity when signal dependencies change
  - Built-in loading/error state management

**Testing**:

- Test user behavior, not implementation details
- Setup functions must destructure parameters in signature with defaults
- Unit tests (`*.spec.ts`): Component behavior in isolation
- Integration tests (`*.integration.spec.ts`): Routing flows only
- **Firebase Timestamp in tests**: Always import from `test-utils/timestamp-mock.ts`, NEVER from `@angular/fire/firestore` (causes JIT compilation errors)
- **userEvent timing**: Always call `userEvent.setup()` AFTER `render()` to avoid ApplicationRef destroyed warnings
- **Shared test utilities**: Use `src/test-utils/` for shared mocks and test helpers to maintain DRY principles

### Hugo Static Site (`/hugo/`)

- Hugo extended v0.129.0+
- Content in `/hugo/content/`
- Doula profiles managed via GitHub App integration
- Pagefind search index built with `bun run index`
- Runs on localhost:1313 during development
- **See [HUGO_GUIDE.md](/HUGO_GUIDE.md)** for environment variables and configuration details

## Code Style

**TypeScript**:

- Use destructuring imports: `import { method } from 'package'`
- Prefer object lookup maps over switch statements
- Always check for and fix lint errors after adding new code

## Firebase Configuration

Hosting targets: `main-site` (Hugo), `members-site` (Angular)
Emulator ports: Auth:9099, Functions:5001, Firestore:8080

## Testing Accounts

For local development with Firebase emulators (Auth, Firestore, Functions):

- **webmaster@doulacooperative.com** / `test1234`
  - Admin account for cooperative management
  - Has member record but NOT a doula member (no public profile)
  - Used for administrative tasks and testing

For Stripe subscription testing (both local and deployed):

- **test-new-member@doulacooperative.com**
  - For testing new member sign-up flow
  - Use for checkout with test card `4242 4242 4242 4242`
  - Forwards to admin's inbox

- **test-existing-member@doulacooperative.com**
  - For testing renewal/existing user flow
  - Create initial member, then test re-subscription
  - Forwards to admin's inbox

## External Integrations

- **Stripe**: Webhook handler for subscription management
- **Mailgun**: Email sending via `MAILGUN_API_KEY` secret
- **GitHub App**: Profile management via `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID`
- bun runs typescript files natively, do not ever suggest using tsx
- deployments are the responsibility of CI or the user, do not deploy any applications
- don't use nested ternaries
- there should only be one exported function per module (file)