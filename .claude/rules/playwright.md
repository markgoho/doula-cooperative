---
paths: members/e2e/**/*.spec.ts
---

## Test Structure

- Playwright tests should NOT look like unit tests - they should have many assertions and cover full user flows
- Group related assertions together under comment headers (e.g., `// === Page Structure ===`)
- Use descriptive test names that explain the user journey being tested

## Authentication Fixture

Use the `authenticatedAdminPage` fixture from `auth-emulator.fixture.ts` for admin tests:

```typescript
import { test } from "../fixtures/auth-emulator.fixture";
import { expect } from "@playwright/test";

test("admin views users", async ({ authenticatedAdminPage }) => {
  // Set up API mocks BEFORE navigating (use regex to match with/without query params)
  await authenticatedAdminPage.route(
    /\/api\/admin\/members(\?|$)/,
    async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ members: [], total: 0 }),
      });
    },
  );

  // Now navigate
  await authenticatedAdminPage.goto("/admin/users");
});
```

The fixture handles sign-in via Firebase Auth emulator with seeded credentials.

## E2E Testing Philosophy

**E2E tests verify user-facing behavior, not API contracts**:

- ✅ Test through UI interactions (clicking buttons, filling forms, navigation)
- ✅ Mock API responses with `page.route()` for controlled scenarios
- ✅ Verify UI responds correctly to different API responses
- ❌ Do NOT test API contracts directly (that's what backend unit tests are for)
- ❌ Do NOT use `page.request.*` to make HTTP calls in tests

**Why this matters**: E2E tests should verify that users can accomplish their goals through the interface. API contract validation belongs in backend unit tests where it's faster, more reliable, and provides better error messages.

## API Mocking with page.route()

### CRITICAL: page.route() vs page.request.\*

**page.route()** mocks requests made **by the browser** (Angular, fetch, XHR):

```typescript
// ✅ CORRECT - Mocks browser-initiated requests
await page.route("**/api/profiles/me", async route => {
  await route.fulfill({ status: 200, body: JSON.stringify(mockData) });
});

// User navigates, Angular makes fetch() call → mock intercepts it ✅
await page.goto("/profile/edit");
```

**page.request.\*** is **Playwright's HTTP client** (runs in Node.js, NOT browser):

```typescript
// ❌ WRONG - Bypasses browser and page.route() mocks entirely!
await page.route("**/api/profiles/me" /* mock */);
const response = await page.request.get("/api/profiles/me");
// Mock never triggers! Request goes directly to server, gets 404
```

**Never use `page.request.*` in E2E tests**. It bypasses:

- Browser context and route mocks
- Angular's HttpClient and interceptors
- CORS handling
- Cookie/session management

If you need to verify API integration, test through UI or use `page.evaluate()` to make fetch calls from browser context.

### Setup Routes Before Navigation

**Always set up routes BEFORE navigation** - routes must be registered before the page makes requests:

```typescript
// ✅ GOOD - Route set up before navigation
await authenticatedAdminPage.route(
  /\/api\/admin\/members(\?|$)/,
  async route => {
    await route.fulfill({ status: 200, body: JSON.stringify(mockData) });
  },
);
await page.goto("/admin/users"); // Route is ready to intercept

// ❌ BAD - Route set up after navigation (requests already made)
await page.goto("/admin/users");
await page.route(/\/api\/admin\/members(\?|$)/ /* ... */); // Too late!
```

**Use `page.route()` not `context.route()`** for more reliable interception.

### Pattern Matching

**Glob vs Regex patterns**:

```typescript
// Glob patterns - `?` is a wildcard character, so avoid for URLs with query params
await page.route("**/api/users/*" /* ... */); // Matches /api/users/123

// Use regex for list endpoints (matches path with or without query params)
await page.route(/\/api\/admin\/members(\?|$)/ /* ... */); // Matches /api/admin/members or /api/admin/members?limit=10
await page.route(/\/api\/admin\/unclaimed-profiles(\?|$)/ /* ... */); // Same pattern for other list endpoints
```

**Handle both GET and other methods**:

```typescript
await page.route(/\/api\/admin\/members(\?|$)/, async route => {
  await (route.request().method() === "GET"
    ? route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResponse),
      })
    : route.continue());
});
```

## Mock Data Types

**Use production API response types** - mock data should match what the real API returns:

```typescript
// ✅ GOOD - Use ISO 8601 strings (what Elysia API returns)
const mockProfile: ApiUnclaimedProfileResponse = {
  email: "test@example.com",
  subscriptionStart: "2024-01-15T10:30:00.000Z", // ISO string
  createdAt: "2024-01-15T10:30:00.000Z",
};

// ❌ BAD - Firebase Timestamp objects (not what API returns over HTTP)
const mockProfile = {
  subscriptionStart: { seconds: 1705315800, nanoseconds: 0 },
};
```

Import types from `api-types/` directory to ensure mock data matches API contracts.

## Known Issues

**Error response mocking can be flaky** - route interception for 500 errors sometimes doesn't work reliably due to timing. If a test mocking error responses is flaky, consider skipping with a TODO comment explaining the issue.

**Angular zoneless change detection** - click events may not trigger Angular change detection when using page object methods. If sorting or interactive features don't respond to clicks, try using inline locators directly in the test instead of page object methods.
