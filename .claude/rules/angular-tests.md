---
paths:
  - "members/**/*.spec.ts"
---

- never use `fixture.detectChanges()` directly in unit tests
- use `TestBed.tick()` from `@angular/core/testing` to flush pending effects after changing signal values from tests (`TestBed.flushEffects()` is deprecated in Angular 22)
- when testing behavior driven by `effect()` that reacts to signal changes, cycle the signal through intermediate values (e.g., `'loading'` → `'error'`) and call `TestBed.tick()` after each `.set()` to ensure effects re-trigger
- use `waitFor` from `@testing-library/angular` after flushing effects to assert DOM updates
- the `setup()` function's return value includes `fixture` from `render()` — prefer `TestBed.tick()` over `fixture.detectChanges()` for flushing effects
- when testing components with writable mock signals, type them as `WritableSignal<T>` so tests can call `.set()` to simulate state transitions
- in integration tests with routing, use the `navigate` function returned by `render()` from `@testing-library/angular` instead of injecting `Router` via `TestBed.inject()` and calling `router.navigateByUrl()` directly
- do not expose implementation details (services, internal state) from the `setup()` function — setup should accept configuration options to set preconditions, and return only things that mimic user behavior (e.g., `navigate`, `screen` queries)
- assert navigation results based on what the user sees (`screen.getByText`, `screen.getByRole`) rather than checking `router.url`
