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
