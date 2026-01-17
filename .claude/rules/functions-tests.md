---
paths: functions/src/**/*.test.ts
---

# Firebase Functions Testing Guidelines

## SIFERS Pattern (Primary Testing Pattern)

**SIFERS** = **Setup In Function with Explicit Return Signature**

All Firebase Functions tests MUST use the SIFERS pattern to eliminate duplication, hide implementation details, and focus on behavioral testing.

### Core Principles

1. **DRY** - Setup function centralizes request construction
2. **Hide HTTP mechanics** - Tests don't know about JSON, headers, URLs
3. **Explicit parameters** - Setup parameters represent test variations
4. **Behavioral focus** - Test HTTP contract (request → response), not implementation

### Complete Example

```typescript
describe("PATCH /:memberId", () => {
  interface SetupOptions {
    // Request parameters - defaults for happy path
    body?: Record<string, unknown>;
    memberId?: string;
    authToken?: string | null; // null to explicitly omit auth

    // Scenario flags - configure mock behavior
    memberNotFound?: boolean;
    validationError?: boolean;
  }

  function setup({
    body = { name: "Updated Name" },
    memberId = "test-member-id",
    authToken = "admin-token",
    memberNotFound = false,
    validationError = false,
  }: SetupOptions = {}) {
    // Configure mocks based on scenario flags
    const mockUpdateMember = mock((id, updates) => {
      if (memberNotFound) {
        return Promise.reject(new NotFoundError("Member not found"));
      }
      if (validationError) {
        return Promise.reject(new ValidationError("Invalid data"));
      }
      // Success path
      return Promise.resolve({ uid: id, ...updates });
    });

    const testApp = createAdminTestPlugin({
      memberAdminService: { updateMember: mockUpdateMember },
    });

    // Build request from parameters (hide HTTP details)
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });

    return { testApp, request, mockUpdateMember };
  }

  // Tests are minimal - only specify what varies
  it("should return 401 without auth", async () => {
    const { testApp, request } = setup({ authToken: null });

    // NOTE: `as Response` is required because Elysia's type inference
    // returns `any` through plugin composition + mocks
    const response = (await testApp.handle(request)) as Response;

    expect(response.status).toBe(401);
  });

  it("should reject invalid email", async () => {
    const { testApp, request } = setup({ body: { email: "invalid" } });

    const response = await testApp.handle(request);

    expect(response.status).toBe(422);
  });

  it("should update member successfully", async () => {
    const { testApp, request } = setup(); // All defaults

    const response = await testApp.handle(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.member.name).toBe("Updated Name");
  });
});
```

### Key Pattern Elements

#### 1. Sensible Defaults (Happy Path)

Every parameter should have a default representing a successful request:

```typescript
function setup({
  body = { name: "Updated Name" }, // Valid data
  memberId = "test-member-id", // Valid ID
  authToken = "admin-token", // Authenticated
  memberNotFound = false, // Success scenario
} = {}) {
  // ...
}
```

**Why?** Tests only specify what varies, making them minimal and expressive.

#### 2. Body as Object Parameter

Use `body` as an object (not JSON string):

```typescript
// ✅ GOOD - Business-level parameter
setup({ body: { email: "new@example.com" } });

// ❌ BAD - Exposing JSON implementation
setup({ body: JSON.stringify({ email: "new@example.com" }) });
```

Setup internally handles `JSON.stringify()`.

#### 3. Null for Explicit Opt-Out

Use `null` to explicitly omit optional parameters (since `undefined` uses default):

```typescript
function setup({
  authToken = "admin-token", // Default: authenticated
} = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    // null is falsy, so header won't be added
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  // ...
}

// Test without auth
setup({ authToken: null }); // ✅ Works - null skips default

// This wouldn't work:
setup({ authToken: undefined }); // ❌ Would use default 'admin-token'
```

**Note:** ESLint allows `null` in `*.test.ts` files for this pattern.

#### 4. Scenario Flags Configure Mocks

Use boolean flags to configure mock behavior:

```typescript
function setup({
  // Scenario flags
  memberNotFound = false,
  serverError = false,
  emailSendFails = false,
} = {}) {
  const mockUpdate = mock(id => {
    if (memberNotFound) throw new NotFoundError("Not found");
    if (serverError) throw new Error("DB error");
    return Promise.resolve({ uid: id });
  });

  const mockEmail = mock(() => {
    if (emailSendFails) throw new Error("SMTP error");
    return Promise.resolve();
  });
  // ...
}

// Usage is expressive
it("should return 404 when not found", async () => {
  const { testApp, request } = setup({ memberNotFound: true });
  // ...
});
```

#### 5. Environment Variables

For tests manipulating environment variables, just set them in setup - no cleanup needed:

```typescript
function setup({
  apiKey = "test-key", // or null to delete
} = {}) {
  // Set environment variable for this test
  if (apiKey === null) {
    delete process.env["API_KEY"];
  } else {
    process.env["API_KEY"] = apiKey;
  }

  // ... create plugin ...

  return { testApp, request, mocks };
}

// No try/finally needed - each test's setup() resets env
it("should fail without API key", async () => {
  const { testApp, request } = setup({ apiKey: null });

  const response = await testApp.handle(request);
  expect(response.status).toBe(503);
});

it("should succeed with API key", async () => {
  const { testApp, request } = setup(); // Uses default apiKey

  const response = await testApp.handle(request);
  expect(response.status).toBe(200);
});
```

**Why no cleanup?** Each test calls `setup()` which sets the environment fresh for that test. Bun provides test isolation, so env vars don't leak between tests.

### What NOT to Test

#### Don't Test Implementation Details

```typescript
// ❌ BAD - Testing mock arguments
it("should call service correctly", async () => {
  const { mockUpdate } = setup();
  await testApp.handle(request);

  expect(mockUpdate).toHaveBeenCalledWith("test-id", { name: "New" });
});

// ✅ GOOD - Testing HTTP contract
it("should update member", async () => {
  const { testApp, request } = setup({ body: { name: "New" } });

  const response = await testApp.handle(request);

  expect(response.status).toBe(200);
  expect((await response.json()).member.name).toBe("New");
});
```

**Why?** If you change how the route calls the service, implementation tests break even though behavior is unchanged.

#### Don't Count Mock Calls

```typescript
// ❌ BAD
expect(mockUpdate).toHaveBeenCalledTimes(1);

// ✅ GOOD - If service isn't called, response will be wrong
expect(response.status).toBe(200);
```

### Type Assertion Required

**Why `as Response` is necessary:**

```typescript
const response = (await testApp.handle(request)) as Response;
```

Elysia's type inference returns `any` when using:

- Plugin composition (`createAdminMembersPlugin()` returning plugin)
- Mocked services via dependency injection
- Node adapter (`@elysiajs/node`)

Without the assertion, TypeScript sees `any` and triggers unsafe access errors. The assertion is safe because `.handle()` always returns a Web API `Response` object at runtime.

**Both assertions are needed:**

```typescript
const response = (await testApp.handle(request)) as Response; // Response type
const body = (await response.json()) as { error?: string }; // Response body type
```

### Test Organization

**All tests must be in `routes/` directories**, NOT in `plugins/`:

- ✅ `admin-members-api/routes/update-member.test.ts`
- ✅ `forms-api/routes/handle-contact-form.test.ts`
- ❌ `admin-members-api/plugins/admin-members-plugin.test.ts` (DON'T create)
- ❌ `forms-api/plugins/contact-us-form-plugin.test.ts` (DON'T create)

**Why?** One test file per route keeps tests manageable. Each file has its own `setup()` tailored to that route's needs.

**What we're testing:** Full plugin through HTTP (including auth guards, derive, etc.), but organized by route for maintainability.

### Migration Checklist

- [ ] Create `setup()` function with `SetupOptions` interface
- [ ] Add request parameters: `body`, `memberId`, `authToken`
- [ ] Use proper types: `body?: Partial<ContactFormBody>`, etc.
- [ ] Add scenario flags: `memberNotFound`, `validationError`, etc.
- [ ] Give all parameters sensible defaults (happy path)
- [ ] Build `request` inside setup from parameters
- [ ] Return `{ testApp, request }` (NO mocks, NO cleanup)
- [ ] Update tests to: `const { testApp, request } = setup(options)`
- [ ] Then: `const response = (await testApp.handle(request)) as Response`
- [ ] Keep `as Response` assertion (required for Elysia types)
- [ ] Remove ALL tests that check mock arguments
- [ ] Remove ALL mock call assertions (`.toHaveBeenCalledWith`, `.toHaveBeenCalledTimes`)
- [ ] Remove `beforeEach`/`beforeAll`/`afterAll` blocks
- [ ] No cleanup functions needed
- [ ] Verify all tests pass

## Shared Auth Mocks

Use the shared auth mocks from `test-utils/auth-mocks.ts` for consistent authentication testing:

```typescript
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "../../test-utils/auth-mocks.js";
```

These mocks implement realistic token-based authentication testing:

- "Bearer admin-token" → Returns admin user token
- "Bearer valid-owner-token" → Returns owner token for test-member-id
- "Bearer non-admin-token" → Throws 403 ForbiddenError
- "Bearer non-owner-token" → Throws 403 ForbiddenError
- Missing/invalid token → Throws 401 AuthError

DO NOT create simplified mocks that always succeed - they won't test authentication failures properly.

## Test Plugin Pattern

Use the create\*TestPlugin factories to test Elysia plugins in isolation:

- `createAdminTestPlugin()` - For admin-members-api tests
- `createMembersTestPlugin()` - For members-api tests

These factories inject mocked services and use the shared auth mocks by default.

## Testing HTTP Contracts (Not Implementation Details)

**Test the HTTP contract** - given this request, verify this response. Do not test:

- How the service is called internally
- What arguments are passed to mocked functions
- Third-party code behavior (Elysia framework, Firebase SDK, etc.)

**Example**:

```typescript
// ✅ GOOD - Test HTTP contract (request → response)
it("should return match request when authorized", async () => {
  const response = (await testApp.handle(
    new Request("http://localhost/request-123", {
      headers: { Authorization: "Bearer admin-token" },
    }),
  )) as Response;

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.id).toBe("request-123");
  expect(body.email).toBe("test@example.com");
});

// ✅ GOOD - Test authentication (part of HTTP contract)
it("should return 401 when not authenticated", async () => {
  const response = (await testApp.handle(
    new Request("http://localhost/request-123"),
  )) as Response;

  expect(response.status).toBe(401);
  expect((await response.json()).error).toBe("Missing Authorization header");
});

// ❌ BAD - Testing implementation details
it("should pass requestId to service", async () => {
  await testApp.handle(new Request("http://localhost/request-123"));

  const callArguments = mockService.mock.calls[0]?.[0]; // Implementation detail!
  expect(callArguments.requestId).toBe("request-123"); // Who cares how service is called?
});

// ❌ BAD - Testing third-party code
it("should call Elysia's set.status method", async () => {
  // Testing framework internals - not our code!
});
```

**What to test**:

- Authentication/authorization (401, 403)
- Input validation (422, 400)
- Success responses (200, structure, data format)
- Error responses (404, 500, error messages)
- That service was invoked (optional, for critical operations)

**What NOT to test**:

- Internal function arguments
- How services are called
- Framework behavior
- Third-party library internals

## Testing Routes

Test routes by calling testApp.handle(new Request(...)) directly:

```typescript
const response = (await testApp.handle(
  new Request("http://localhost/admin/members", {
    headers: { Authorization: "Bearer admin-token" },
  }),
)) as Response;

expect(response.status).toBe(200);
```

Always test authentication/authorization scenarios before testing business logic.

## Testing Framework

**Test framework**: Elysia uses Bun's native test runner (not a custom framework)

**CRITICAL: Never mock Firebase/Firestore internals**:

```typescript
// ❌ WRONG - Mocking Firebase internals is an anti-pattern
mock.module("firebase-admin/firestore", () => ({
  getFirestore: mockGetFirestore,
}));

mock.module("firebase-admin/auth", () => ({
  getAuth: mockGetAuth,
}));

// ✅ CORRECT - Mock service interfaces at route level
const mockMemberService = {
  findById: mock(id => Promise.resolve({ uid: id, email: "test@example.com" })),
};
```

**Why this matters**:

- Mocking internals couples tests to implementation details
- Makes refactoring difficult
- Hides integration issues
- Violates dependency injection principles
- Tests should mock at service boundaries, not internal modules

## Logger: Do Not Mock

**Do NOT mock or include the logger in test utilities**. Let tests use the real Firebase logger.

```typescript
// ✅ CORRECT - Don't include logger in test plugin options
export function createProfilesTestPlugin(overrides?: {
  profileGitHubService?: Partial<ProfileGitHubService>;
  profileMemberService?: Partial<ProfileMemberService>;
  authService?: Partial<AuthService>;
  // NO logger option
}) {
  return createProfilesPlugin({
    profileGitHubService: defaultProfileGitHubService,
    profileMemberService: defaultProfileMemberService,
    authService: defaultAuthService,
    // NO logger passed - uses default Firebase logger
  });
}

// ❌ WRONG - Mocking the logger
const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
};

export function createTestPlugin(overrides?: {
  logger?: Logger; // Don't include this
}) {
  return createPlugin({
    logger: overrides?.logger ?? mockLogger, // Don't do this
  });
}
```

**Why not mock the logger?**

- Tests remain simple without extra mock setup
- Logging code paths are exercised during tests
- Real logs help debug failing tests
- There's rarely value in asserting what was logged

## Plugin-Based Testing (Recommended)

**Test plugins in isolation** - don't create the full app for unit tests:

```typescript
// test-utils/create-admin-test-plugin.ts
import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createAdminMembersPlugin } from "../plugins/admin-members-plugin.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "../../test-utils/auth-mocks.js";

/**
 * Creates the admin-members plugin with default mock services for testing.
 * Tests only the admin plugin in isolation - no full app composition needed.
 */
export function createAdminTestPlugin(overrides?: {
  memberAdminService?: Partial<MemberAdminService>;
  authService?: Partial<AuthService>;
  logger?: Logger;
}) {
  const defaultMemberAdminService: MemberAdminService = {
    verifyMemberExists: mock(() => Promise.resolve({} as MemberDocument)),
    listMembers: mock(() => Promise.resolve({ members: [], total: 0 })),
    updateMember: mock(() => Promise.resolve({} as MemberDocument)),
    // ... other methods
    ...overrides?.memberAdminService,
  };

  const defaultAuthService: AuthService = {
    verifyAuthToken: mock(() => Promise.resolve({} as DecodedIdToken)),
    verifyAdmin: createMockVerifyAdmin(), // Uses shared auth mock
    verifyOwnerOrAdmin: createMockVerifyOwnerOrAdmin(), // Uses shared auth mock
    ...overrides?.authService,
  };

  return createAdminMembersPlugin({
    memberAdminService: defaultMemberAdminService,
    authService: defaultAuthService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
```

**Usage in tests**:

```typescript
import { describe, expect, it, mock } from "bun:test";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

describe("GET /admin/members", () => {
  it("should return members list", async () => {
    const mockListMembers = mock(() =>
      Promise.resolve({ members: [{ uid: "1" }], total: 1 }),
    );

    // Create plugin with specific mock - only what this test needs
    const plugin = createAdminTestPlugin({
      memberAdminService: { listMembers: mockListMembers },
    });

    const response = (await plugin.handle(
      new Request("http://localhost/admin/members", {
        headers: { Authorization: "Bearer admin-token" },
      }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(mockListMembers).toHaveBeenCalled();
  });

  it("should return 401 without auth header", async () => {
    const plugin = createAdminTestPlugin();

    const response = (await plugin.handle(
      new Request("http://localhost/admin/members"),
      // No authorization header
    )) as Response;

    expect(response.status).toBe(401);
  });
});
```

**Benefits of plugin-based testing**:

- ✅ Faster test execution (no full app overhead)
- ✅ True isolation - only test one plugin's behavior
- ✅ Simpler mocks - only need to mock plugin's dependencies
- ✅ Clearer test failures - easier to pinpoint issues
- ✅ Matches plugin architecture

## DO NOT Test Services Independently

**NEVER write service layer tests.** Services are implementation details and should only be tested indirectly through route tests.

**Why we don't test services**:

- Services are implementation details of the HTTP/UI layer
- Route tests with mocked services are sufficient
- Testing services directly couples tests to implementation
- Service tests would require mocking Firestore/external APIs, adding complexity
- Focus testing effort on user-facing behavior, not internal abstractions

**What to test instead**:

- ✅ Test HTTP routes with mocked services
- ✅ Test E2E user journeys with mocked API responses
- ✅ Test Angular components/services that call APIs
- ❌ Do NOT test service methods directly
- ❌ Do NOT write tests for utility functions used only by services

## Running Tests

```bash
# All API tests
bun test functions/src/**/*-api/

# Specific test file
bun test functions/src/admin-members-api/routes/list-members.test.ts

# Watch mode
bun test --watch functions/src/**/*-api/
```
