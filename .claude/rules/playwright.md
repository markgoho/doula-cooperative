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
  await authenticatedAdminPage.route(/\/api\/admin\/members(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ members: [], total: 0 }),
    });
  });

  // Now navigate
  await authenticatedAdminPage.goto("/admin/users");
});
```

The fixture handles sign-in via Firebase Auth emulator with seeded credentials.

## API Mocking with page.route()

**Always set up routes BEFORE navigation** - routes must be registered before the page makes requests:

```typescript
// ✅ GOOD - Route set up before navigation
await authenticatedAdminPage.route(/\/api\/admin\/members(\?|$)/, async (route) => {
  await route.fulfill({ status: 200, body: JSON.stringify(mockData) });
});
await page.goto("/admin/users"); // Route is ready to intercept

// ❌ BAD - Route set up after navigation (requests already made)
await page.goto("/admin/users");
await page.route(/\/api\/admin\/members(\?|$)/, /* ... */); // Too late!
```

**Use `page.route()` not `context.route()`** for more reliable interception.

**Glob vs Regex patterns**:

```typescript
// Glob patterns - `?` is a wildcard character, so avoid for URLs with query params
await page.route("**/api/users/*", /* ... */); // Matches /api/users/123

// Use regex for list endpoints (matches path with or without query params)
await page.route(/\/api\/admin\/members(\?|$)/, /* ... */); // Matches /api/admin/members or /api/admin/members?limit=10
await page.route(/\/api\/admin\/unclaimed-profiles(\?|$)/, /* ... */); // Same pattern for other list endpoints
```

**Handle both GET and other methods**:

```typescript
await page.route(/\/api\/admin\/members(\?|$)/, async (route) => {
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
