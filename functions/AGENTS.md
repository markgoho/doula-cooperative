# AGENTS.md

Monorepo with Hugo static site, Firebase Functions, and Angular members portal. Tech stack: Firebase, Hugo, Angular, TypeScript, SCSS, Bun.

## Build/Lint/Test Commands

- **Single test:** `cd functions && bun test test/claim-profile.test.ts`
- **All tests:** `cd functions && bun test`
- **Lint:** `cd functions && npm run lint`
- **Build:** `cd functions && npm run build`

## Firebase Functions Patterns

- **Structure:** Functions exported from `src/index.ts` with lazy imports for cold start optimization
- **Collections:** Use constants from `src/collections/index.ts` (e.g., `MEMBERS_COLLECTION`)
- **Idempotent:** Keep functions idempotent unless involving timestamps
- **Secrets:** Declare in function config with `secrets: ["SECRET_NAME"]`, access via `process.env.SECRET_NAME`

## Key Collections

- `members` - Primary user collection (uid, email, membershipActive, stripeCustomerId, etc.)
- `messages` - Contact form submissions
- `matchRequests` - Doula match form submissions
- `migrated_users_import` - Temporary collection for pre-imported profiles
- `processed_stripe_events` - Webhook idempotency tracking

## External Services

- **Stripe:** Webhook handler for `checkout.session.completed`, creates users after payment
- **Mailgun:** Email triggers for contact forms and match requests
- **GitHub:** Octokit integration for reading Hugo content from `hugo/content/doulas/`

## Testing

### General Testing Practices

- Uses Firebase emulators (Firestore: 127.0.0.1:8080, Auth: 127.0.0.1:9099)
- Test utilities in `src/test-utils/`: setup functions, mock request/response, firestore helpers
- Follow Arrange-Act-Assert with cleanup in `afterAll` hooks

### Required Test Coverage

**IMPORTANT:** All route logic files MUST have corresponding test files.

- **Route logic files** (`src/*/routes/*.ts`):
  - MUST have a corresponding test file (`src/*/routes/*.test.ts`)
  - Tests must cover:
    - Authentication (401 unauthorized, 403 forbidden)
    - Input validation (422 for invalid inputs)
    - Success cases (200/201 responses)
    - Error handling (404 not found, 500 server errors)
  - Use `createAdminTestPlugin()` or similar test factory from `test-utils/`
  - Follow existing test patterns in the same directory

- **Service layer files** (`src/*/services/*.ts`):
  - Should have tests for complex business logic
  - Not required for simple CRUD wrappers

- **Test file patterns:**

  ```typescript
  // Standard structure for route tests
  describe("HTTP_METHOD /route-path", () => {
    function setup(options) {
      /* ... */
    }

    describe("Authentication", () => {
      /* 401, 403 tests */
    });
    describe("Validation", () => {
      /* 422 tests */
    });
    describe("Success cases", () => {
      /* 200/201 tests */
    });
    describe("Error handling", () => {
      /* 404, 500 tests */
    });
  });
  ```

### Route Logic Requirements

All route logic functions MUST include proper error handling:

- Wrap service calls in `try/catch` blocks
- Use `handleRouteError()` from `shared-api/utils/route-error-handler.js` in catch blocks
- Add corresponding error ID constant to `src/constants/error-ids.ts`
- Return type must include both success shape and `| { error: string }`

**Example:**

```typescript
export async function myRouteLogic({ ... }): Promise<SuccessType | { error: string }> {
  try {
    const result = await service.doSomething();
    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "operation name",
      errorId: ERROR_IDS.API_MY_OPERATION_FAILED,
      logger,
      set,
      context: { /* relevant context */ }
    });
  }
}
```

## Type Safety

- Strict TypeScript with `strict: true`
- Member documents: `MemberDocument` type from `src/types/member-document.ts`
- Form data: Typed interfaces in feature directories (e.g., `src/doula-match-form/types.ts`)

## Cursor Rules

Follow `firebase-functions.mdc`: Collection constants, idempotent functions
