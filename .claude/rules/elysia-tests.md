---
paths: functions/src/**/*-api/**/*.test.ts
---

# Elysia API Testing Guidelines

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
  logger?: Logger;  // Don't include this
}) {
  return createPlugin({
    logger: overrides?.logger ?? mockLogger,  // Don't do this
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

## Testing Services Independently

Test services without HTTP framework involvement. **Service layer tests are CRITICAL** because route tests mock services and don't exercise actual error handling code.

### Testing Firestore Operations

**IMPORTANT**: Service tests should verify error handling around Firestore operations:

```typescript
import { describe, expect, it } from "bun:test";
import { getMessage } from "./get-message.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";

describe("getMessage service", () => {
  it("should throw NotFoundError when message doesn't exist", async () => {
    const mockLogger = { warn: () => {}, error: () => {}, info: () => {} };

    try {
      await getMessage({
        messageId: "non-existent-id",
        logger: mockLogger,
      });
      throw new Error("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });

  // Note: Testing Firestore network failures requires Firebase emulator or mocking
  // These tests verify the error handling path exists and logs correctly
});
```

### Testing Auth Services

```typescript
import { AuthService } from "../../shared-api/services/auth/index.js";
import { AuthError } from "../../shared-api/errors/http-error.js";

it("should throw AuthError for missing header", async () => {
  try {
    await AuthService.verifyAuthToken(undefined);
    throw new Error("Should have thrown");
  } catch (error) {
    expect(error).toBeInstanceOf(AuthError);
    if (error instanceof AuthError) {
      expect(error.statusCode).toBe(401);
    }
  }
});
```

### Why Service Tests Matter

Route tests mock services, so they don't catch:

- Missing try-catch blocks around Firestore operations
- Incorrect error logging (missing error IDs, wrong context)
- Service-level business logic bugs
- Improper error type handling

Always add service tests when:

- Creating new service methods
- Adding Firestore operations
- Changing error handling logic

## Running Tests

```bash
# All API tests
bun test functions/src/**/*-api/

# Specific test file
bun test functions/src/admin-members-api/routes/list-members.test.ts

# Watch mode
bun test --watch functions/src/**/*-api/
```
