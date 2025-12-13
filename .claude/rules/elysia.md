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

## Route Organization

**Each endpoint in separate module**: Keep `app.ts` minimal by extracting route handlers to `routes/` directory

```typescript
// app.ts - Registry only
import { healthRoute } from "./routes/health.js";
import { getMember } from "./routes/members.js";

export const app = new Elysia({ adapter: node(), prefix: "/api" })
  .get("/health", () => healthRoute())
  .get("/members/:memberId", (context) => getMember(context));
```

```typescript
// routes/members.ts - Handler implementation
import type { Context } from "elysia";

export async function getMember({
  params,
  set,
}: Context<{ params: Record<"memberId", string> }>) {
  // implementation
}
```

## Type Usage

**Use Elysia's Context type**: Import from `elysia` for proper typing without `any`

```typescript
import type { Context } from "elysia";

// For routes with params
Context<{ params: Record<"paramName", string> }>

// For routes with body
Context<{ body: SomeInterface }>
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