---
paths: functions/src/api/**.ts
---

# Elysia.js API Patterns

## Core Setup

**Required adapter**: Use `@elysiajs/node` adapter for Node.js compatibility (Firebase Functions runs on Node.js, not Bun)

**No prefix needed**: Firebase rewrites already provide the path prefix for each function

```typescript
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";

export const app = new Elysia({ adapter: node() });
```

### Firebase Rewrite Pattern

Each Elysia plugin is deployed as a **separate Firebase Function** with its own path prefix defined in `firebase.json`:

```json
// firebase.json
{
  "hosting": [{
    "rewrites": [
      {
        "source": "/api/members/**",
        "function": "membersApi"
      },
      {
        "source": "/api/admin/members/**",
        "function": "adminMembersApi"
      }
    ]
  }]
}
```

**IMPORTANT**: Plugins define routes **without** the Firebase rewrite prefix:

```typescript
// ✅ CORRECT - Plugin defines route from its "root"
// Firebase serves this at /api/members/:memberId
export function createMembersPlugin() {
  return new Elysia({ name: "members" })
    .get("/:memberId", handler);  // NOT /members/:memberId
}

// ❌ WRONG - Don't repeat the Firebase path prefix
export function createMembersPlugin() {
  return new Elysia({ name: "members" })
    .get("/members/:memberId", handler);  // Would become /api/members/members/:memberId
}
```

**Why this pattern:**
- ✅ Each plugin is a separate Cloud Function (better cold start, independent scaling)
- ✅ Firebase handles routing to the correct function
- ✅ Plugin routes are clean and relative to their function's base path
- ✅ Easy to understand: `/api/members/**` → `membersApi` function → plugin routes start from `/`

### Complete Routing Flow Examples

**Example 1: Members API**
```
User Request:     GET /api/members/user123
                       ↓
Firebase Rewrite: /api/members/** → membersApi function
                       ↓
Elysia Plugin:    GET /:memberId (matches with memberId = "user123")
                       ↓
Final Route:      ✅ Successfully handled
```

**Example 2: Admin Members API with nested routes**
```
User Request:     POST /api/admin/members/user123/membership/activate
                       ↓
Firebase Rewrite: /api/admin/members/** → adminMembersApi function
                       ↓
Elysia Plugin:    POST /:memberId/membership/activate (matches with memberId = "user123")
                       ↓
Final Route:      ✅ Successfully handled
```

**Example 3: Wrong approach (DON'T DO THIS)**
```
User Request:     GET /api/members/user123
                       ↓
Firebase Rewrite: /api/members/** → membersApi function
                       ↓
Elysia Plugin:    GET /members/:memberId ❌ WRONG!
                       ↓
Attempted Match:  GET /members/user123 (but Firebase sent "/user123")
                       ↓
Final Route:      ❌ 404 Not Found
```

## Folder Structure

Organize code by feature with clear separation of concerns:

```
src/api/
├── errors/               # Custom HTTP error classes
├── plugins/              # Elysia plugins (route groups with guards)
│   ├── admin-members-plugin.ts
│   └── members-plugin.ts
├── services/             # Business logic (decoupled from HTTP)
│   ├── auth-service/     # Each auth function in separate file
│   │   ├── verify-token.ts
│   │   ├── verify-admin.ts
│   │   ├── verify-owner-or-admin.ts
│   │   └── index.ts      # Exports AuthService object
│   └── member-service.ts
├── routes/               # Route logic functions (no auth code)
│   └── admin-members/    # Grouped by plugin
├── test-utils/           # Test utilities and factories
├── types/                # Type definitions
│   ├── route-context.ts  # RouteContext type
│   └── services.ts       # Service constants & types
├── adapters.ts           # Firebase ↔ Elysia conversion
├── app.ts                # App factory - composes plugins
└── handler.ts            # Main entry point
```

**IMPORTANT**: Follow CLAUDE.md rule - "one exported function per module". Split services into separate files if they export multiple functions.

## Plugin Pattern (Recommended)

**Use plugins to organize route groups with shared behavior**:

```typescript
// plugins/admin-members-plugin.ts
import { Elysia } from "elysia";

// Firebase rewrite: /api/admin/members/** → adminMembersApi function
// Plugin routes start from "/" (Firebase already provides /api/admin/members prefix)
export function createAdminMembersPlugin(services?: PartialServices) {
  return new Elysia({ name: "admin-members" })
    .decorate(SERVICE_KEYS.MEMBER_ADMIN_SERVICE, services?.memberAdminService ?? MemberAdminService)
    .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
    // Plugin-specific decorations only - don't decorate services other plugins need
    .get("/", handler)  // Served at /api/admin/members/
    .group("/:memberId", { params: MemberIdParameterSchema }, app =>
      app
        .patch("/", updateHandler)       // Served at /api/admin/members/:memberId
        .delete("/", deleteHandler)      // Served at /api/admin/members/:memberId
        .group("/membership", app =>
          app
            .post("/activate", activateHandler)      // Served at /api/admin/members/:memberId/membership/activate
            .post("/deactivate", deactivateHandler)  // Served at /api/admin/members/:memberId/membership/deactivate
        )
    );
}
```

**Compose plugins in app.ts** - Use this pattern when multiple plugins share a single Firebase Function:

```typescript
// main-api/app.ts - Multiple plugins in one Firebase Function
// Firebase rewrite: /main-api/** → mainApi function
export function createApp(services?: PartialServices) {
  return new Elysia({ adapter: node() })
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .get("/health", () => healthRoute())
    .use(createContactUsFormPlugin(services))     // Served at /main-api/contact-us-form
    .use(createDoulaMatchFormPlugin(services));   // Served at /main-api/doula-match-form
}
```

**One plugin per Firebase Function** - Use this pattern for isolated APIs with separate scaling:

```typescript
// members-api/app.ts - Single plugin, dedicated Firebase Function
// Firebase rewrite: /api/members/** → membersApi function
export function createApp(services?: PartialServices) {
  return new Elysia({ adapter: node() })
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .use(createMembersPlugin(services));  // Routes start from /
}

// admin-members-api/app.ts - Single plugin, dedicated Firebase Function
// Firebase rewrite: /api/admin/members/** → adminMembersApi function
export function createApp(services?: PartialServices) {
  return new Elysia({ adapter: node() })
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .use(createAdminMembersPlugin(services));  // Routes start from /
}
```

**Benefits of plugin pattern**:
- ✅ Route groups isolated in separate files
- ✅ Each plugin only decorates its needed services
- ✅ Nested `.group()` for hierarchical route organization
- ✅ Plugins can have their own guards (see below)
- ✅ Plugins are testable in isolation
- ✅ One plugin per function enables independent scaling and cold start optimization
- ✅ Multiple plugins per function reduces infrastructure complexity when routes share dependencies

## Authentication Guards with derive + onBeforeHandle

**Centralize authentication in plugin guards** instead of checking auth in every route handler:

```typescript
// plugins/admin-members-plugin.ts
import type { DecodedIdToken } from "firebase-admin/auth";
import { HttpError } from "../errors/http-error.js";

/**
 * Auth result from derive - either a token or an error.
 * IMPORTANT: Index signature required for Elysia's derive return type.
 */
interface AuthResult {
  [key: string]: unknown;  // Required by Elysia's type system
  adminToken: DecodedIdToken | undefined;
  authError: HttpError | undefined;
}

/**
 * Helper to extract admin UID - avoids non-null assertions in route handlers.
 */
function getAdminUid(adminToken: DecodedIdToken | undefined): string {
  if (!adminToken) {
    throw new Error("Admin token missing - should not happen after guard");
  }
  return adminToken.uid;
}

// Firebase rewrite: /api/admin/members/** → adminMembersApi function
export function createAdminMembersPlugin(services?: PartialServices) {
  return new Elysia({ name: "admin-members" })
    .decorate(/* ... */)
    // derive() runs first - adds adminToken to context
    .derive(async ({ request, authService }): Promise<AuthResult> => {
      const authorizationHeader = request.headers.get("authorization") ?? undefined;
      try {
        const token = await authService.verifyAdmin(authorizationHeader);
        return { adminToken: token, authError: undefined };
      } catch (error) {
        if (error instanceof HttpError) {
          return { adminToken: undefined, authError: error };
        }
        return { adminToken: undefined, authError: new HttpError("Authentication failed", 401) };
      }
    })
    // onBeforeHandle() runs after derive - blocks unauthorized requests
    .onBeforeHandle(
      { as: "local" },  // Only applies to routes in this plugin
      ({ adminToken, authError, set }): { error: string } | undefined => {
        if (!adminToken && authError) {
          set.status = authError.statusCode;  // Preserves 401 vs 403
          return { error: authError.message };
        }
        if (!adminToken) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        return undefined;  // Continue to route handler
      },
    )
    // Routes start from "/" - Firebase provides /api/admin/members prefix
    .get("/", async ({ adminToken, memberAdminService, logger, set }) =>
      listMembersLogic({
        adminUid: getAdminUid(adminToken),  // Safe - guard ensures token exists
        memberAdminService,
        logger,
        set,
      })
    );
}
```

**Why this pattern?**
- ✅ Auth checked once per plugin, not in every route
- ✅ Route logic functions don't need auth code (DRY)
- ✅ `derive` adds `adminToken` to context for all routes
- ✅ `onBeforeHandle` blocks unauthorized before handlers run
- ✅ Preserves specific error codes (401 vs 403)
- ✅ `{ as: "local" }` ensures guard only applies to this plugin's routes

**IMPORTANT: Index signature in derive return type**:

Elysia requires an index signature on derive return types. Without it you'll get a TypeScript error:

```typescript
// ❌ WRONG - TypeScript error
interface AuthResult {
  adminToken: DecodedIdToken | undefined;
}

// ✅ CORRECT - Include index signature
interface AuthResult {
  [key: string]: unknown;  // Required for Elysia's derive
  adminToken: DecodedIdToken | undefined;
}
```

## Route Logic Functions (Simplified)

With auth handled by the plugin guard, route logic functions are simpler:

```typescript
// routes/admin-members/list-members.ts
export async function listMembersLogic({
  limit,
  offset,
  adminUid,        // Already verified by guard
  memberAdminService,
  logger,
  set,
}: {
  limit?: number;
  offset?: number;
  adminUid: string;  // Not optional - guard guarantees it
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<MemberListResponse | { error: string }> {
  try {
    logger.info("Admin listing members", { adminUid });
    const result = await memberAdminService.listMembers({ limit, offset });
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }
    set.status = 500;
    return { error: "Failed to list members" };
  }
}
```

**What's removed from logic functions when using guards**:
- ❌ `authorizationHeader` parameter
- ❌ `authService` parameter
- ❌ `authService.verifyAdmin()` call
- ❌ Auth error handling (401/403)

**What's added**:
- ✅ `adminUid: string` parameter (already verified)

## Route Organization

**Use factory pattern for testability**: Export `createApp()` function that accepts injectable dependencies

### Extracted Logic Functions (Best Practice)

Following Elysia best practice: "DON'T pass entire Context to controllers". Extract logic to separate functions, destructure context in app.ts:

```typescript
// app.ts - Destructure context, pass specific values
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { getMemberLogic } from "./routes/members.js";
import { MemberIdParameterSchema } from "./schemas/member-schemas.js";
import { MemberService } from "./services/member-service.js";
import { AuthService } from "./services/auth-service.js";

export function createApp(services?: PartialServices) {
  return new Elysia({ adapter: node() })
    .decorate(SERVICE_KEYS.MEMBER_SERVICE, services?.memberService ?? MemberService)
    .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
    .get(
      "/members/:memberId",
      async ({ params, memberService, authService, logger, request, set }) =>
        getMemberLogic({
          memberId: params.memberId,  // Extract specific values
          memberService,
          authService,
          logger,
          authorizationHeader: request.headers.get("authorization") ?? undefined,
          set,
        }),
      {
        params: MemberIdParameterSchema,
      },
    );
}
```

```typescript
// routes/members.ts - Logic function (NOT an HTTP handler)
import { HttpError } from "../errors/http-error.js";
import { toMemberResponse, type MemberResponse } from "../schemas/member-schemas.js";
import type { MemberService, AuthService } from "../services/service-interfaces.js";
import type { Logger } from "../handler.js";

export async function getMemberLogic({
  memberId,
  memberService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;  // Explicit types, no Context coupling
  memberService: MemberService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<MemberResponse | { error: string }> {
  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(authorizationHeader, memberId);
    const member = await memberService.findById(memberId);
    return toMemberResponse(member);
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }
    set.status = 500;
    return { error: "Internal error" };
  }
}
```

**Why this pattern?**
- ✅ No Context coupling (follows Elysia best practices)
- ✅ No type assertions needed
- ✅ Full type safety with explicit types
- ✅ Elysia's automatic type inference in app.ts
- ✅ Logic functions are testable and reusable
- ✅ Clear separation: routing config vs business logic

## Service Layer & Dependency Injection

**Services are decoupled from HTTP**: Keep business logic independent of Elysia/HTTP framework

**Use SERVICE_KEYS constants**: Centralize service keys to prevent typos and enable refactoring

```typescript
// types/services.ts
export const SERVICE_KEYS = {
  MEMBER_SERVICE: "memberService",
  AUTH_SERVICE: "authService",
  LOGGER: "logger",
} as const;

export interface Services {
  [SERVICE_KEYS.MEMBER_SERVICE]: MemberService;
  [SERVICE_KEYS.AUTH_SERVICE]: AuthService;
  [SERVICE_KEYS.LOGGER]: Logger;
}

export type PartialServices = Partial<Services>;
```

**Use factory pattern with `decorate`**: Create app with injectable dependencies

```typescript
// app.ts
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

export function createApp(services?: PartialServices) {
  return new Elysia({ adapter: node() })
    .decorate(SERVICE_KEYS.MEMBER_SERVICE, services?.memberService ?? MemberService)
    .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .get("/members/:memberId", (context) => getMember(context));
}

// Production uses real services
export const app = createApp();

// Tests inject mock services
const testApp = createApp({ memberService: mockService });
```

**Use RouteContext type for route handlers**:

```typescript
// types/route-context.ts
import type { Services } from "./services.js";

export interface RouteContext<TParameters = unknown> {
  params: TParameters;
  request: Request;
  set: { status?: number | string };
}

// Extend with services for all routes
export type RouteContextWithServices<TParameters = unknown> = RouteContext<TParameters> & Services;
```

**Access services in routes**:

```typescript
// routes/members.ts
import type { RouteContext } from "../types/route-context.js";
import type { MemberDocument } from "../../types/member-document.js";

export async function getMember({
  params,
  memberService,  // Injected via decorate
  logger,         // Injected via decorate
  set,
}: RouteContext<{ memberId: string }>): Promise<MemberDocument | { error: string }> {
  try {
    return await memberService.findById(params.memberId);
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Unexpected error", { error, memberId: params.memberId });
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
import { AuthService } from "./services/auth-service/index.js";

export const app = new Elysia({ adapter: node() })
  .decorate(SERVICE_KEYS.AUTH_SERVICE, AuthService)
  .get("/protected", (context) => protectedRoute(context));
```

**Auth service is split into separate files** (one export per module):

```typescript
// services/auth-service/verify-token.ts
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { logger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { AuthError } from "../../errors/http-error.js";

export async function verifyAuthToken(
  authorizationHeader: string | undefined
): Promise<DecodedIdToken> {
  if (!authorizationHeader) {
    throw new AuthError("Missing Authorization header");
  }

  if (!authorizationHeader.startsWith("Bearer ")) {
    throw new AuthError("Authorization header must use Bearer scheme");
  }

  const token = authorizationHeader.slice(7).trim();
  if (token.length === 0) {
    throw new AuthError("Missing auth token");
  }

  try {
    const auth = getAuth();
    return await auth.verifyIdToken(token);
  } catch (error) {
    // Use Firebase error codes, NOT string matching on error messages
    if (error && typeof error === 'object' && 'code' in error) {
      const firebaseError = error as { code: string };

      switch (firebaseError.code) {
        case 'auth/id-token-expired':
          logger.warn("Expired auth token", {
            errorId: ERROR_IDS.API_AUTH_TOKEN_EXPIRED,
            errorCode: firebaseError.code,
          });
          throw new AuthError("Your session has expired. Please sign in again.");

        case 'auth/id-token-revoked':
          logger.warn("Revoked auth token", {
            errorId: ERROR_IDS.API_AUTH_TOKEN_REVOKED,
            errorCode: firebaseError.code,
          });
          throw new AuthError("Your session has been revoked. Please sign in again.");

        // ... handle other error codes
        default:
          logger.error("Firebase Auth verification failed", {
            errorId: ERROR_IDS.API_AUTH_VERIFICATION_FAILED,
            error,
            errorCode: firebaseError.code,
          });
          throw new AuthError("Unable to verify authentication token.");
      }
    }
    throw new AuthError("Unable to verify authentication token.");
  }
}
```

```typescript
// services/auth-service/index.ts
import { verifyAuthToken } from "./verify-token.js";
import { verifyAdmin } from "./verify-admin.js";
import { verifyOwnerOrAdmin } from "./verify-owner-or-admin.js";

export const AuthService = {
  verifyAuthToken,
  verifyAdmin,
  verifyOwnerOrAdmin,
};

// Re-export for direct imports
export { verifyAuthToken, verifyAdmin, verifyOwnerOrAdmin };
```

**CRITICAL**: Use Firebase error codes, NOT string matching:

```typescript
// ❌ WRONG - Fragile, breaks with message changes
if (error.message.includes("expired")) {
  throw new AuthError("Token expired");
}

// ✅ CORRECT - Reliable, uses Firebase error codes
if (error.code === "auth/id-token-expired") {
  throw new AuthError("Token expired");
}
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

**Note**: Convert `null` to `undefined` when passing to services because service method signatures use `string | undefined` for optional parameters (whereas `headers.get()` returns `string | null`)

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

### RouteContext Type Patterns

**Empty params type**: For routes without path parameters (like `GET /admin/members`), use `Record<string, never>` instead of `unknown`:

```typescript
// ✅ CORRECT - Type-safe empty params
RouteContext<Record<string, never>, { limit?: number; offset?: number }>

// ❌ WRONG - Causes type errors with TypeScript strict mode
RouteContext<unknown, { limit?: number; offset?: number }>
```

**Body type intersection**: Routes with request bodies need to intersect `RouteContext` with a body type:

```typescript
// ✅ CORRECT - Intersect with body type
RouteContext<{ memberId: string }> & { body: Partial<MemberDocument> }

// Also valid - No query params generic needed
RouteContext<{ memberId: string }> & { body: { newExpirationDate: string } }
```

**Why intersection**: `RouteContext` doesn't include `body` by default, so you must intersect with a separate type that includes it.

### Use Schema Constants for DRY Routes

Extract all validation schemas to constants in `schemas/` directory:

```typescript
// schemas/member-schemas.ts
export const MemberIdParameterSchema = t.Object({
  memberId: t.String({
    minLength: 1,
    maxLength: 128,
    description: "The Firestore document ID of the member",
    error: "Member ID must be a non-empty string (max 128 characters)",
  }),
});

export const UpdateMemberBodySchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  email: t.Optional(t.String({ format: "email" })),
  // ...
});
```

**Usage in app.ts** - Clean and DRY:
```typescript
.patch(
  "/admin/members/:memberId",
  context => updateMember(context as unknown as RouteContext<{ memberId: string }> & {
    body: Record<string, unknown>;
  }),
  {
    params: MemberIdParameterSchema,  // Reusable schema constant
    body: UpdateMemberBodySchema,      // Reusable schema constant
  },
)
```

**Benefits:**
- Single source of truth for validation rules
- Consistent error messages across routes
- Easy to update validation in one place
- Self-documenting API contracts

## Schema-First API Design

### Separate API and Firestore Types

Use Elysia schemas as source of truth for API contracts, keep Firestore types separate:

```typescript
// schemas/member-schemas.ts

// API response schema (uses ISO 8601 date strings)
export const MemberResponseSchema = t.Object({
  uid: t.String(),
  email: t.String({ format: "email" }),
  createdAt: t.String({ format: "date-time" }),  // ISO string for JSON
  // ...
});

export type MemberResponse = Static<typeof MemberResponseSchema>;

// Firestore document type (uses Timestamp objects)
import type { Timestamp } from "firebase-admin/firestore";

export interface MemberDocument {
  uid: string;
  email: string;
  createdAt: Timestamp;  // Firestore Timestamp object
  // ...
}

// Conversion utility (Firestore → API)
export function toMemberResponse(doc: MemberDocument): MemberResponse {
  return {
    ...doc,
    createdAt: doc.createdAt.toDate().toISOString(),
    // ... convert all Timestamp fields to ISO strings
  };
}
```

**Why separate types?**
- HTTP APIs speak JSON (ISO date strings)
- Firestore speaks Timestamps (not JSON-serializable)
- Clear boundary where serialization happens
- Schemas define the API contract, not storage format

**Usage in routes:**
```typescript
const member = await memberService.findById(memberId);  // Returns MemberDocument
return toMemberResponse(member);  // Convert to MemberResponse for API
```

## Handler Patterns

### Extracted Handlers Require Arrow Wrappers

When using extracted handlers with dependency injection, wrap them in arrow functions with type assertions:

```typescript
// ✅ CORRECT - Arrow wrapper with type assertion for extracted handlers
.get(
  "/members/:memberId",
  context => getMember(context as unknown as RouteContext<{ memberId: string }>),
  { params: MemberIdParameterSchema }
)

// ❌ WRONG - Direct reference breaks Elysia's type inference
.get("/members/:memberId", getMember, { params: MemberIdParameterSchema })
```

### Inline Handlers Get Automatic Type Inference

For inline handlers, Elysia automatically infers all types from `decorate`:

```typescript
// ✅ Fully type-safe with no assertions needed
.get("/members/:memberId", async ({ params, memberService, authService }) => {
  // params.memberId is typed automatically
  // memberService and authService are fully typed
  return await memberService.findById(params.memberId);
})
```

**When to use each:**
- **Extracted handlers**: Use for complex logic that needs testing, reusability, or would make app.ts too large
- **Inline handlers**: Use for simple operations or when automatic type inference is critical

## Dependencies

**Reduce Express reliance**:
- Import `Request` from `firebase-functions/v2/https` (not `express`)
- `Response` currently still from `express` (Firebase v2 limitation)
- Long-term goal: eliminate Express dependency entirely

## Testing Patterns

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
  findById: mock((id) => Promise.resolve({ uid: id, email: "test@example.com" })),
};
```

**Why this matters**:
- Mocking internals couples tests to implementation details
- Makes refactoring difficult
- Hides integration issues
- Violates dependency injection principles
- Tests should mock at service boundaries, not internal modules

### Plugin-Based Testing (Recommended)

**Test plugins in isolation** - don't create the full app for unit tests:

```typescript
// test-utils/test-app-factory.ts
import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createAdminMembersPlugin } from "../plugins/admin-members-plugin.js";
import { createMockVerifyAdmin } from "./auth-mocks.js";

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
    verifyAdmin: createMockVerifyAdmin(),  // Returns valid admin token by default
    verifyOwnerOrAdmin: mock(() => Promise.resolve({} as DecodedIdToken)),
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
import { createAdminTestPlugin } from "../test-utils/test-app-factory.js";
import { NotFoundError } from "../errors/http-error.js";

describe("GET /admin/members", () => {
  it("should return members list", async () => {
    const mockListMembers = mock(() =>
      Promise.resolve({ members: [{ uid: "1" }], total: 1 })
    );

    // Create plugin with specific mock - only what this test needs
    const plugin = createAdminTestPlugin({
      memberAdminService: { listMembers: mockListMembers },
    });

    const response = await plugin.handle(
      new Request("http://localhost/admin/members", {
        headers: { authorization: "Bearer valid-token" },
      })
    ) as Response;

    expect(response.status).toBe(200);
    expect(mockListMembers).toHaveBeenCalled();
  });

  it("should return 401 without auth header", async () => {
    const plugin = createAdminTestPlugin();

    const response = await plugin.handle(
      new Request("http://localhost/admin/members")
      // No authorization header
    ) as Response;

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

### Auth Mock Utilities

Create reusable auth mocks that default to successful authentication:

```typescript
// test-utils/auth-mocks.ts
import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import { AuthError, ForbiddenError } from "../errors/http-error.js";

/**
 * Creates a mock verifyAdmin that succeeds with a default admin token.
 */
export function createMockVerifyAdmin(options?: {
  uid?: string;
  shouldFail?: boolean;
  failWithForbidden?: boolean;
}) {
  return mock((authorizationHeader: string | undefined) => {
    if (!authorizationHeader) {
      return Promise.reject(new AuthError("Missing Authorization header"));
    }
    if (options?.shouldFail) {
      return Promise.reject(new AuthError("Invalid token"));
    }
    if (options?.failWithForbidden) {
      return Promise.reject(new ForbiddenError("Not an admin"));
    }
    return Promise.resolve({
      uid: options?.uid ?? "admin-user-123",
      admin: true,
    } as DecodedIdToken);
  });
}
```

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

## Error Handling & Logging

**Always include error IDs**: Add error IDs from `constants/error-ids.ts` for Sentry tracking

```typescript
import { ERROR_IDS } from "../../constants/error-ids.js";

logger.error("Failed to fetch member data", {
  errorId: ERROR_IDS.API_MEMBER_FETCH_FAILED,
  error,
  errorMessage: error instanceof Error ? error.message : "Unknown error",
  errorStack: error instanceof Error ? error.stack : undefined,
  memberId,
});
```

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
