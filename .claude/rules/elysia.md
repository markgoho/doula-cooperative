---
paths: functions/src/api/**.ts
---

# Elysia.js API Patterns

## Core Setup

**Required adapter**: Use `@elysiajs/node` adapter for Node.js compatibility (Firebase Functions runs on Node.js, not Bun)

**No prefix needed**: Firebase function name already provides the path prefix

```typescript
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";

// Firebase function named "api" provides /api prefix
export const app = new Elysia({ adapter: node() });
```

## Folder Structure

Organize code by feature with clear separation of concerns:

```
src/api/
├── errors/          # Custom HTTP error classes
├── services/        # Business logic (decoupled from HTTP)
├── routes/          # Route handlers (controllers)
├── adapters.ts      # Firebase ↔ Elysia conversion
├── app.ts           # App factory with dependency injection
└── handler.ts       # Main entry point
```

## Route Organization

**Use factory pattern for testability**: Export `createApp()` function that accepts injectable dependencies

```typescript
// app.ts - Factory with dependency injection
import { Elysia, t } from "elysia";
import { node } from "@elysiajs/node";
import { healthRoute } from "./routes/health.js";
import { getMember } from "./routes/members.js";
import { MemberService } from "./services/member-service.js";
import { AuthService } from "./services/auth-service.js";

export function createApp(services?: {
  memberService?: typeof MemberService;
  authService?: typeof AuthService;
}) {
  return new Elysia({ adapter: node() })
    .decorate("memberService", services?.memberService ?? MemberService)
    .decorate("authService", services?.authService ?? AuthService)
    .get("/health", () => healthRoute())
    .get(
      "/members/:memberId",
      (context) => getMember(context),
      {
        params: t.Object({
          memberId: t.String({
            minLength: 1,
            maxLength: 128,
            error: "Member ID must be a non-empty string (max 128 characters)",
          }),
        }),
      },
    );
}

// Export default app instance for production
export const app = createApp();
```

```typescript
// routes/members.ts - Lightweight controller
import type { Context } from "elysia";
import { MemberService } from "../services/member-service.js";
import { HttpError } from "../errors/http-error.js";

export async function getMember({
  params,
  set,
}: Context<{ params: Record<"memberId", string> }>) {
  try {
    return await MemberService.findById(params.memberId);
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }
    set.status = 500;
    return { error: "Internal server error" };
  }
}
```

## Service Layer & Dependency Injection

**Services are decoupled from HTTP**: Keep business logic independent of Elysia/HTTP framework

**Use factory pattern with `decorate`**: Create app with injectable dependencies

```typescript
// app.ts
export function createApp(services?: {
  memberService?: typeof MemberService;
  authService?: typeof AuthService;
}) {
  return new Elysia({ adapter: node() })
    .decorate("memberService", services?.memberService ?? MemberService)
    .decorate("authService", services?.authService ?? AuthService)
    .get("/members/:memberId", (context) => getMember(context));
}

// Production uses real services
export const app = createApp();

// Tests inject mock services
const testApp = createApp({ memberService: mockService });
```

**Access services in routes**:

```typescript
// routes/members.ts
export async function getMember({
  params,
  memberService,  // Injected via decorate
  set,
}: {
  params: { memberId: string };
  memberService: { findById: (id: string) => Promise<unknown> };
  set: { status?: number | string };
}) {
  try {
    return await memberService.findById(params.memberId);
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }
    set.status = 500;
    return { error: "Internal server error" };
  }
}
```

**Why objects over classes**: Use plain objects with functions instead of classes with static methods (preferred by ESLint rules and Elysia best practices)

```typescript
// ✅ Correct - Plain object
export const MemberService = {
  async findById(id: string) { /* ... */ }
};

// ❌ Avoid - Class with only static methods (lint error)
export class MemberService {
  static async findById(id: string) { /* ... */ }
}
```

## Custom Error Classes

**HTTP errors with status codes**: Create error classes for different HTTP status codes

```typescript
// errors/http-error.ts
export class HttpError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthError extends HttpError {
  constructor(message: string) {
    super(message, 401);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string) {
    super(message, 403);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ValidationError extends HttpError {
  constructor(message: string) {
    super(message, 400);
  }
}
```

**Usage in routes**:

```typescript
try {
  return await MemberService.findById(params.memberId);
} catch (error) {
  if (error instanceof HttpError) {
    set.status = error.statusCode;
    return { error: error.message };
  }
  // Unexpected error
  set.status = 500;
  return { error: "Internal server error" };
}
```

## Input Validation

**Use Elysia's built-in validation**: Add validation schemas to route definitions

```typescript
import { Elysia, t } from "elysia";

export const app = new Elysia({ adapter: node() })
  .get(
    "/members/:memberId",
    (context) => getMember(context),
    {
      params: t.Object({
        memberId: t.String({
          minLength: 1,
          maxLength: 128,
          description: "The Firestore document ID",
          error: "Member ID must be a non-empty string",
        }),
      }),
    },
  )
  .post(
    "/members",
    (context) => createMember(context),
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        email: t.String({ format: "email" }),
      }),
    },
  );
```

**Benefits**:
- Automatic validation before handler runs
- Returns 422 status code on validation failure
- Type inference from schema
- Self-documenting API

## Authentication Patterns

**Inject AuthService with `decorate`**:

```typescript
// app.ts
import { AuthService } from "./services/auth-service.js";

export const app = new Elysia({ adapter: node() })
  .decorate("authService", AuthService)
  .get("/protected", (context) => protectedRoute(context));
```

**Auth service is decoupled**: Takes only what it needs, not full Context

```typescript
// services/auth-service.ts
export const AuthService = {
  async verifyAuthToken(authHeader: string | undefined) {
    if (!authHeader) {
      throw new AuthError("Missing Authorization header");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new AuthError("Authorization header must use Bearer scheme");
    }

    const token = authHeader.slice(7).trim();
    if (token.length === 0) {
      throw new AuthError("Missing auth token");
    }

    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  },

  async verifyAdmin(authHeader: string | undefined) {
    const decodedToken = await AuthService.verifyAuthToken(authHeader);

    if (decodedToken["admin"] !== true) {
      throw new ForbiddenError("This endpoint requires admin privileges");
    }

    return decodedToken;
  },
};
```

**Usage in routes with injected service**:

```typescript
export async function getMember({
  params,
  memberService,
  authService,
  request,
  set,
}: {
  params: { memberId: string };
  memberService: { findById: (id: string) => Promise<unknown> };
  authService: { verifyOwnerOrAdmin: (authHeader: string | undefined, resourceUid: string) => Promise<{ uid: string }> };
  request: Request;
  set: { status?: number | string };
}) {
  const authHeader = request.headers.get("authorization") ?? undefined;

  try {
    await authService.verifyOwnerOrAdmin(authHeader, params.memberId);
    return await memberService.findById(params.memberId);
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }
    throw error;
  }
}
```

**Index signature properties**: Use bracket notation for Firebase token custom claims in service layer

```typescript
// services/auth-service.ts
const isAdmin = decodedToken["admin"] === true;  // ✅ Required for index signature
```

**Note**: Convert `null` to `undefined` when passing to services (headers.get() returns `string | null`)

```typescript
const authHeader = request.headers.get("authorization") ?? undefined;
```

## Type Usage

**Use Elysia's Context type**: Import from `elysia` for proper typing

```typescript
import type { Context } from "elysia";

// For routes with params
Context<{ params: Record<"memberId", string> }>

// For routes with body
Context<{ body: { name: string; email: string } }>
```

## Arrow Functions in Routes

**Always wrap handlers**: Use arrow functions to call route handlers (not direct function references)

```typescript
// ✅ Correct - allows transformation/middleware
.get("/path", (context) => handler(context))

// ❌ Wrong - loses flexibility
.get("/path", handler)
```

## Dependencies

**Reduce Express reliance**:
- Import `Request` from `firebase-functions/v2/https` (not `express`)
- `Response` currently still from `express` (Firebase v2 limitation)
- Long-term goal: eliminate Express dependency entirely

## Testing Patterns

**Test framework**: Elysia uses Bun's native test runner (not a custom framework)

**Use factory pattern for clean testing**: Call `createApp()` with mock services - no duplication!

```typescript
import { describe, expect, it, mock } from "bun:test";
import { createApp } from "../../src/api/app.js";
import { NotFoundError } from "../../src/api/errors/http-error.js";

describe("GET /members/:memberId", () => {
  // Create mock service
  const mockFindById = mock((memberId: string) => {
    if (memberId === "test-id") {
      return Promise.resolve({ id: "test-id", name: "Test" });
    }
    return Promise.reject(new NotFoundError("Member not found"));
  });

  // Create app with mocked service - all routes from app.ts included!
  const testApp = createApp({
    memberService: {
      findById: mockFindById,
    },
  });

  it("should return member data", async () => {
    const response = await testApp.handle(
      new Request("http://localhost/members/test-id")
    ) as Response;

    expect(response.status).toBe(200);
  });

  it("should call service with correct ID", async () => {
    await testApp.handle(
      new Request("http://localhost/members/test-id")
    );

    expect(mockFindById).toHaveBeenCalledWith("test-id");
  });
});
```

**Benefits of factory pattern for testing**:
- ✅ No code duplication - route definitions only in `app.ts`
- ✅ No Firebase emulators needed
- ✅ Fast test execution
- ✅ Single source of truth for routes and validation
- ✅ Easy to inject mock services

**Use Eden Treaty for simple routes**:

```typescript
import { treaty } from "@elysiajs/eden";
import { app } from "../../src/api/app.js";

const api = treaty(app);

it("should return status ok", async () => {
  const { data, status } = await api.health.get();

  expect(status).toBe(200);
  expect(data).toEqual({ status: "ok" });
});
```

**Testing services independently**:

```typescript
import { AuthService } from "../../src/api/services/auth-service.js";
import { AuthError } from "../../src/api/errors/http-error.js";

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

**Running tests**:
```bash
# All API tests
bun test test/api/

# Specific test file
bun test test/api/health.test.ts

# Watch mode
bun test --watch test/api/
```

## Error Handling

**Return error objects, don't throw in routes**: Let route handlers catch and convert errors

```typescript
// ✅ Correct - Catch HttpError in route
export async function getMember(context: Context) {
  try {
    return await MemberService.findById(context.params.memberId);
  } catch (error) {
    if (error instanceof HttpError) {
      context.set.status = error.statusCode;
      return { error: error.message };
    }
    context.set.status = 500;
    return { error: "Internal server error" };
  }
}

// ✅ Correct - Throw HttpError in service
export const MemberService = {
  async findById(id: string) {
    const doc = await getDoc(id);
    if (!doc.exists) {
      throw new NotFoundError("Member not found");
    }
    return doc.data();
  }
};
```

**Set status before returning error**:

```typescript
context.set.status = 404;
return { error: "Not found", message: "Resource does not exist" };
```

## Best Practices Summary

1. **Service Layer**: Extract business logic to services (plain objects with functions)
2. **Custom Errors**: Use HttpError subclasses with status codes
3. **Decouple Services**: Don't pass Context to services - extract only what's needed
4. **Input Validation**: Use Elysia.t schemas on routes
5. **Error Handling**: Catch HttpError in routes, set status, return error objects
6. **Testing**: Use Eden Treaty for type-safe tests when possible
7. **No Static Classes**: Use objects instead of classes with only static methods
