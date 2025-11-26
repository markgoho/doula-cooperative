# ApplicationRef Destroyed Error Investigation

## Problem Statement

The test suite produces "ApplicationRef has already been destroyed" (NG0406) errors. All tests pass successfully, but stderr shows accumulated warnings.

## ROOT CAUSE IDENTIFIED

**The issue is Vitest file parallelism.**

When multiple test files run in parallel:
1. Each test file creates its own Angular ApplicationRef
2. When one file's tests complete, testing-library cleanup destroys that ApplicationRef
3. Other files' tests may have pending async operations (from `resource()` API, routing, etc.)
4. Those pending operations try to use the destroyed ApplicationRef, triggering NG0406

### Evidence

| Test Configuration | ApplicationRef Errors |
|-------------------|----------------------|
| Single test file | 0 |
| Files added incrementally | 0 |
| `bun run test` (default, no isolation) | ~1700+ |
| `bun run test` (with `isolate: true`) | **0** |

## THE FIX

Add `isolate: true` to vitest config:

**vitest.config.mts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    isolate: true,
  },
});
```

**angular.json** (add `runnerConfig`):
```json
"test": {
  "builder": "@angular/build:unit-test",
  "options": {
    "runnerConfig": "vitest.config.mts",
    // ... other options
  }
}
```

The `isolate: true` setting ensures each test file runs in its own isolated environment, preventing the ApplicationRef from being shared across parallel test files.

## Technical Details

### Why Parallelism Causes Issues with Angular

Angular's zoneless change detection + `resource()` API creates reactive async operations that:
- Start automatically when signals change
- May still be pending when test cleanup runs
- Try to update signals after ApplicationRef destruction

This is especially problematic with:
- Components using `resource()` for data loading
- Integration tests with routing/navigation
- Any test that triggers async Angular operations

### Files That Commonly Trigger Errors

Tests involving these patterns show more errors:
- `resource()` API usage
- Router navigation (`router.navigateByUrl()`)
- Component-level service providers

## Document History

- 2025-11-25: Initial investigation
- 2025-11-25: **ROOT CAUSE FOUND** - Test isolation in Vitest
- 2025-11-25: **FIX CONFIRMED** - `isolate: true` in vitest.config.mts
