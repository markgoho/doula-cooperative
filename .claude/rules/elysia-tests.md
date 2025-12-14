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

Test services without HTTP framework involvement:

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

## Running Tests

```bash
# All API tests
bun test functions/src/**/*-api/

# Specific test file
bun test functions/src/admin-members-api/routes/list-members.test.ts

# Watch mode
bun test --watch functions/src/**/*-api/
```
