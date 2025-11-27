# Angular Resource API Pattern

This document describes the correct pattern for using Angular's `resource` API for reactive async data loading (Angular 21+).

> **⚠️ Experimental API**: The `resource` API is experimental and may change before stabilization.

## Core API

### Configuration Object

```typescript
const dataResource = resource({
  params: () => ({
    /* reactive parameters */
  }),
  loader: ({ params, abortSignal, previous }) => {
    // Load and return data using params
    // Return a Promise directly - async/await not required
  },
});
```

### Key Properties

- **`params`**: Function that returns reactive parameters. When any signal read inside changes, the resource automatically triggers a new load.
- **`loader`**: Function that returns a Promise. Receives `ResourceLoaderParams` object with:
  - `params`: The value returned from the `params` function
  - `abortSignal`: For request cancellation (automatically aborts when params change)
  - `previous`: Object with `status` property containing the previous `ResourceStatus`

### Exposed Resource Signals and Methods

#### Read Signals

- `resource.value()`: The loaded data (or `undefined` if not loaded/error)
- `resource.hasValue()`: Boolean indicating if resource has a value (also acts as type guard)
- `resource.isLoading()`: Boolean loading state
- `resource.error()`: Error object if load failed (or `undefined`)
- `resource.status()`: Current `ResourceStatus` (see status states below)

#### Write Methods

- `resource.reload()`: Manually trigger a reload with current params
- `resource.set(value)`: Locally set the resource value (status becomes `'local'`)
- `resource.update(fn)`: Update the resource value using a function (status becomes `'local'`)

### Resource Status States

| Status        | value()           | Meaning                                 |
| ------------- | ----------------- | --------------------------------------- |
| `'idle'`      | `undefined`       | No valid request; loader hasn't run yet |
| `'error'`     | `undefined`       | Loader encountered an error             |
| `'loading'`   | `undefined`       | Loader running from params change       |
| `'reloading'` | Previous value    | Loader running from `reload()` call     |
| `'resolved'`  | Resolved value    | Loader completed successfully           |
| `'local'`     | Locally set value | Value set via `.set()` or `.update()`   |

## Complete Example

### Component with Input-Triggered Loading

```typescript
import { Component, inject, input, resource, computed } from '@angular/core';

@Component({
  // ... component config
})
export class MemberDetailComponent {
  private memberService = inject(MemberService);

  // Route parameter input
  uid = input.required<string>();

  // Resource automatically loads when uid changes
  protected memberResource = resource({
    params: () => ({ uid: this.uid() }),
    loader: ({ params, abortSignal }) =>
      this.memberService.getMember(params.uid, { signal: abortSignal }),
  });

  // Transform error to string for display
  protected errorMessage = computed(() => {
    const err = this.memberResource.error();
    return err ? 'Failed to load member. Please try again.' : undefined;
  });

  // Method to manually reload
  protected reload(): void {
    this.memberResource.reload();
  }
}
```

### Template Usage

#### ⚠️ CRITICAL: Do NOT Extract Value Before Error Checking

**WRONG - This will throw an error:**

```html
<!-- ❌ DON'T DO THIS - value() throws when resource is in error state -->
@let memberResource = service.memberResource; @let member = memberResource.value();
<!-- This throws if resource has error! -->

@if (memberResource.isLoading()) {
<p>Loading...</p>
} @else if (errorMessage(); as err) {
<p class="error">{{ err }}</p>
}
```

**Calling `.value()` on a resource in an error state throws an error:** `Resource is currently in an error state`

#### Recommended: Extract Resource Only, Then Value in Conditional

```html
<!-- ✅ CORRECT - Extract resource at top, call value() inside conditional -->
@let memberResource = service.memberResource; @if (memberResource.isLoading()) {
<p>Loading...</p>
} @else if (service.errorMessage(); as err) {
<p class="error">{{ err }}</p>
} @else if (memberResource.value(); as member) {
<!-- member is non-undefined here, fully type-safe -->
<div>{{ member.name }}</div>
}
```

#### Alternative: Using Status States

```html
<!-- Extract resource only - value() called within cases where it's safe -->
@let memberResource = service.memberResource; @switch (memberResource.status()) { @case ('loading')
{
<p>Loading...</p>
} @case ('reloading') {
<!-- Show content with loading overlay during reload -->
@if (memberResource.value(); as member) {
<div class="reloading-overlay">
  <div>{{ member.name }}</div>
  <spinner />
</div>
} } @case ('error') {
<p class="error">{{ service.errorMessage() }}</p>
} @case ('resolved') { @if (memberResource.value(); as member) {
<div>{{ member.name }}</div>
} } }
```

> **Best Practice**: Only extract the resource with `@let` at the top of your template. Call `.value()` inside conditionals where you've confirmed the resource is not in an error state. This prevents runtime errors when the resource fails to load.

## Key Benefits

1. **Automatic Reactivity**: Resource automatically reloads when `params` dependencies change
2. **Built-in State Management**: No need for manual `loading`, `error`, `data` signals
3. **Declarative**: Resource loading is defined once, not triggered manually
4. **Cleaner Code**: Eliminates `effect()` + manual async function pattern

## Common Patterns

### Conditional Loading

```typescript
private profileResource = resource({
  params: () => {
    const user = this.userService.currentUser();
    // Only load if user has a profile
    return user?.hasProfile ? { profileId: user.profileId } : undefined;
  },
  loader: ({ params }) => this.profileService.getProfile(params.profileId),
});
```

When `params` returns `undefined`, the loader doesn't run and status becomes `'idle'`.

### Multiple Dependencies

```typescript
private dataResource = resource({
  params: () => ({
    userId: this.userId(),
    filter: this.filterType(),
    page: this.currentPage(),
  }),
  loader: ({ params }) => this.api.fetchData(params),
});
```

Resource reloads whenever ANY of the signals in `params` change.

### Request Cancellation

```typescript
// Simple case - just return the Promise
loader: ({ params, abortSignal }) =>
  fetch(`/api/users/${params.id}`, { signal: abortSignal }).then((r) => r.json());
```

Resources automatically abort outstanding operations when params change. Always pass `abortSignal` to async operations that support it.

### When to Use `async/await` in Loaders

**Use `async/await` ONLY when you need synchronous work before/after the async call:**

```typescript
// ✅ Need async/await for synchronous logic
loader: async ({ params, previous }) => {
  // Synchronous conditional logic
  if (previous.status === 'resolved') {
    // Different behavior for refreshes
  }

  const result = await this.service.getData(params.id);

  // Synchronous transformation
  const transformed = this.parseData(result);

  return transformed;
};

// ❌ Don't use async/await for simple cases
loader: async ({ params }) => {
  return await this.service.getData(params.id); // Unnecessarily verbose
};

// ✅ Simple case - just return the Promise
loader: ({ params }) => this.service.getData(params.id);
```

### Optimistic Updates with Local Mutations

```typescript
export class ProfileComponent {
  private profileResource = resource({
    params: () => ({ userId: this.userId() }),
    loader: async ({ params }) => {
      return await this.profileService.getProfile(params.userId);
    },
  });

  async updateProfile(updates: Partial<Profile>): Promise<void> {
    // Optimistically update the UI immediately
    this.profileResource.update((current) => ({ ...current, ...updates }));

    try {
      await this.profileService.updateProfile(this.userId(), updates);
      // Success - the optimistic update is now confirmed
    } catch (err) {
      // Revert to server state on error
      this.profileResource.reload();
      throw err;
    }
  }
}
```

Using `.set()` or `.update()` changes the status to `'local'`, allowing you to distinguish between server data and local mutations.

### Using `previous` Status for Conditional Logic

```typescript
// Need async/await here for synchronous logic
loader: async ({ params, previous }) => {
  // Synchronous conditional logic
  if (previous.status === 'resolved') {
    // This is a refresh - can implement background refresh logic
  }

  return await this.service.getData(params.id);
};
```

## Testing Considerations

### Handling Resource Loading in Tests

Resources trigger loading after component initialization. For most tests, the mock service should resolve immediately:

```typescript
const mockService = {
  getMember: vi.fn().mockResolvedValue(mockMember),
};
```

### Testing Loading State

To test loading state, use a promise that doesn't auto-resolve:

```typescript
let resolveMember: (value: Member) => void;
const pendingPromise = new Promise<Member>((resolve) => {
  resolveMember = resolve;
});

const mockService = {
  getMember: vi.fn().mockReturnValue(pendingPromise),
};

// Render component - it will be in loading state
await render(Component, { providers: [{ provide: Service, useValue: mockService }] });

// Assert loading state
expect(await screen.findByText('Loading...')).toBeVisible();

// Clean up - resolve promise
resolveMember(mockMember);
```

### Testing `hasValue()` Type Guards

```typescript
it('should display content when resource has value', async () => {
  const mockService = {
    getMember: vi.fn().mockResolvedValue(mockMember),
  };

  await render(Component, {
    providers: [{ provide: MemberService, useValue: mockService }],
  });

  // Wait for resource to resolve
  expect(await screen.findByText(mockMember.name)).toBeVisible();
});
```

### Testing Status States

```typescript
it('should show reloading state during manual reload', async () => {
  const mockService = {
    getMember: vi.fn().mockResolvedValue(mockMember),
  };

  const { rerender } = await render(Component, {
    providers: [{ provide: MemberService, useValue: mockService }],
  });

  // Wait for initial load
  await screen.findByText(mockMember.name);

  // Trigger reload
  const reloadButton = screen.getByRole('button', { name: /reload/i });

  // Setup second request to not resolve immediately
  let resolveReload: (value: Member) => void;
  const reloadPromise = new Promise<Member>((resolve) => {
    resolveReload = resolve;
  });
  mockService.getMember.mockReturnValue(reloadPromise);

  await userEvent.click(reloadButton);

  // Should show reloading UI (implementation specific)
  expect(screen.getByTestId('reloading-overlay')).toBeVisible();

  // Clean up
  resolveReload(mockMember);
});
```

### Testing Optimistic Updates

```typescript
it('should optimistically update and revert on error', async () => {
  const mockService = {
    getProfile: vi.fn().mockResolvedValue(mockProfile),
    updateProfile: vi.fn().mockRejectedValue(new Error('Update failed')),
  };

  await render(Component, {
    providers: [{ provide: ProfileService, useValue: mockService }],
  });

  // Wait for initial load
  await screen.findByText(mockProfile.name);

  // Trigger optimistic update
  const input = screen.getByLabelText(/name/i);
  await userEvent.clear(input);
  await userEvent.type(input, 'New Name');

  // Should see optimistic update
  expect(screen.getByText('New Name')).toBeVisible();

  // Submit and wait for error
  const submitButton = screen.getByRole('button', { name: /save/i });
  await userEvent.click(submitButton);

  // Should revert to original value after reload
  await waitFor(() => {
    expect(screen.getByText(mockProfile.name)).toBeVisible();
  });
});
```

## Anti-Patterns to Avoid

### ❌ CRITICAL: Extracting value before error checking

```html
<!-- WRONG - This throws "Resource is currently in an error state" -->
@let resource = service.memberResource; @let member = resource.value();
<!-- Throws if resource has error! -->

@if (resource.isLoading()) {
<p>Loading...</p>
}
```

### ✅ Call value() inside conditional

```html
<!-- CORRECT - Only call value() after checking error state -->
@let resource = service.memberResource; @if (resource.isLoading()) {
<p>Loading...</p>
} @else if (service.errorMessage(); as err) {
<p class="error">{{ err }}</p>
} @else if (resource.value(); as member) {
<div>{{ member.name }}</div>
}
```

### ❌ Reading signals directly in loader

```typescript
// WRONG - Don't reference this.uid() in the loader
loader: () => this.service.getMember(this.uid());
```

### ✅ Use params passed to loader

```typescript
// CORRECT - Use params from loader argument
loader: ({ params }) => this.service.getMember(params.uid);
```

### ❌ Using `effect()` with resource

```typescript
// WRONG - Resource handles reactivity, no need for effect
constructor() {
  effect(() => {
    const uid = this.uid();
    this.memberResource.reload();  // Don't do this
  });
}
```

### ✅ Let params handle reactivity

```typescript
// CORRECT - Just define params, resource auto-reloads
private memberResource = resource({
  params: () => ({ uid: this.uid() }),  // Auto-reactive!
  loader: ({ params }) => this.service.getMember(params.uid)
});
```

## Migration from Manual Pattern

### Before (Manual State Management)

```typescript
export class OldComponent {
  protected data = signal<Data | undefined>(undefined);
  protected loading = signal(true);
  protected error = signal<string | undefined>(undefined);

  id = input.required<string>();

  constructor() {
    effect(() => {
      const currentId = this.id();
      if (currentId) {
        void this.loadData();
      }
    });
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    this.data.set(undefined);

    try {
      const result = await this.service.getData(this.id());
      this.data.set(result);
    } catch (err) {
      console.error('Error loading data:', err);
      this.error.set('Failed to load data.');
    } finally {
      this.loading.set(false);
    }
  }
}
```

### After (Resource API)

```typescript
export class NewComponent {
  id = input.required<string>();

  private dataResource = resource({
    params: () => ({ id: this.id() }),
    loader: ({ params }) => this.service.getData(params.id),
  });

  protected errorMessage = computed(() => {
    const err = this.dataResource.error();
    return err ? 'Failed to load data.' : undefined;
  });
}
```

**Lines eliminated**: ~20 lines of boilerplate
**Benefits**: Automatic reactivity, cleaner code, built-in state management

## Advanced Features Summary

### Type Safety with `hasValue()`

The `hasValue()` method provides both runtime checking and TypeScript type narrowing:

```typescript
// Without hasValue() - value() could be undefined
if (this.memberResource.value()) {
  // TypeScript still thinks value() might be undefined
  const name = this.memberResource.value().name; // Error!
}

// With hasValue() - TypeScript knows value is defined
if (this.memberResource.hasValue()) {
  const name = this.memberResource.value().name; // ✓ Safe!
}
```

### Local Mutations for Optimistic UI

Use `.set()` and `.update()` for immediate UI feedback before server confirmation:

```typescript
// Immediate update
this.resource.set(newValue);

// Transform current value
this.resource.update((current) => ({ ...current, ...changes }));

// Status becomes 'local' to distinguish from server data
if (this.resource.status() === 'local') {
  // Show "Saving..." indicator
}
```

### Distinguishing Load Types with Status

The `'loading'` vs `'reloading'` status distinction allows different UX:

```typescript
@if (resource.status() === 'loading') {
  <skeleton-loader />  // First load
} @else if (resource.status() === 'reloading') {
  <content-with-spinner />  // Background refresh
}
```

## Quick Reference

| Feature       | Purpose               | Example                                      | ⚠️ Notes                                                          |
| ------------- | --------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `value()`     | Get current data      | `@if (resource.value(); as data)`            | **Throws if error state!** Only call after checking loading/error |
| `hasValue()`  | Type-safe value check | `if (resource.hasValue())`                   | Safe to call anytime                                              |
| `isLoading()` | Loading state check   | `@if (resource.isLoading())`                 | Safe to call anytime                                              |
| `error()`     | Get error object      | `resource.error()?.message`                  | Safe to call anytime                                              |
| `status()`    | Detailed state        | `resource.status() === 'reloading'`          | Safe to call anytime                                              |
| `reload()`    | Manual refresh        | `resource.reload()`                          | -                                                                 |
| `set()`       | Replace value         | `resource.set(newValue)`                     | Changes status to 'local'                                         |
| `update()`    | Transform value       | `resource.update(v => ({...v, ...changes}))` | Changes status to 'local'                                         |

## Best Practices Checklist

- ✅ Use `@let` to extract resource at top of template (`@let resource = service.resource`)
- ✅ Call `.value()` only inside conditionals after checking loading/error state
- ✅ Use `@if (resource.value(); as data)` to safely extract value
- ✅ Check `resource.isLoading()` and `service.errorMessage()` before accessing value
- ✅ Pass `abortSignal` to all async operations
- ✅ Return `undefined` from `params` for conditional loading
- ✅ Use `'reloading'` status for better UX during refreshes
- ✅ Implement optimistic updates with `.update()` + `.reload()` on error
- ✅ Expose resource directly to template (not individual signals)
- ❌ **CRITICAL:** Don't call `.value()` at template top - it throws when resource has error
- ❌ Don't extract value with `@let data = resource.value()` before error checking
- ❌ Don't read signals directly in loader (use `params`)
- ❌ Don't use `effect()` with resources (params handles reactivity)
- ❌ Don't manually manage loading/error states
- ❌ Don't repeat `service.resourceName` throughout template
