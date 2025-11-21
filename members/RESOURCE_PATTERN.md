# Angular Resource API Pattern

This document describes the correct pattern for using Angular's `resource` API for reactive async data loading (Angular 21+).

> **⚠️ Experimental API**: The `resource` API is experimental and may change before stabilization.

## Core API

### Configuration Object

```typescript
const dataResource = resource({
  params: () => ({ /* reactive parameters */ }),
  loader: async ({ params, abortSignal, previous }) => {
    // Load and return data using params
  }
});
```

### Key Properties

- **`params`**: Function that returns reactive parameters. When any signal read inside changes, the resource automatically triggers a new load.
- **`loader`**: Async function that loads data. Receives `ResourceLoaderParams` object with:
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

| Status | value() | Meaning |
|--------|---------|---------|
| `'idle'` | `undefined` | No valid request; loader hasn't run yet |
| `'error'` | `undefined` | Loader encountered an error |
| `'loading'` | `undefined` | Loader running from params change |
| `'reloading'` | Previous value | Loader running from `reload()` call |
| `'resolved'` | Resolved value | Loader completed successfully |
| `'local'` | Locally set value | Value set via `.set()` or `.update()` |

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
    loader: async ({ params, abortSignal }) => {
      return await this.memberService.getMember(params.uid, { signal: abortSignal });
    },
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

#### Recommended: Using `@let` to Extract Resource and Value

```html
<!-- Extract resource and value at top of template -->
@let memberResource = service.memberResource;
@let member = memberResource.value();

@if (memberResource.isLoading()) {
  <p>Loading...</p>
} @else if (errorMessage(); as err) {
  <p class="error">{{ err }}</p>
} @else if (member) {
  <!-- member is non-undefined here, fully type-safe -->
  <div>{{ member.name }}</div>
}
```

#### Alternative: Using Status States

```html
@let memberResource = service.memberResource;
@let member = memberResource.value();

@switch (memberResource.status()) {
  @case ('loading') {
    <p>Loading...</p>
  }
  @case ('reloading') {
    <!-- Show content with loading overlay during reload -->
    <div class="reloading-overlay">
      <div>{{ member.name }}</div>
      <spinner />
    </div>
  }
  @case ('error') {
    <p class="error">{{ errorMessage() }}</p>
  }
  @case ('resolved') {
    <div>{{ member.name }}</div>
  }
}
```

> **Best Practice**: Extract both the resource and its value at the top of your template with `@let`. This provides the cleanest, most maintainable pattern with minimal repetition.

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
  loader: async ({ params }) => {
    return await this.profileService.getProfile(params.profileId);
  },
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
  loader: async ({ params }) => {
    return await this.api.fetchData(params);
  },
});
```

Resource reloads whenever ANY of the signals in `params` change.

### Request Cancellation

```typescript
loader: async ({ params, abortSignal }) => {
  const response = await fetch(`/api/users/${params.id}`, {
    signal: abortSignal  // Browser will cancel pending request if params change
  });
  return response.json();
}
```

Resources automatically abort outstanding operations when params change. Always pass `abortSignal` to async operations that support it.

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
    this.profileResource.update(current => ({ ...current, ...updates }));

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
loader: async ({ params, previous }) => {
  // Only show loading spinner on initial load, not on refreshes
  if (previous.status === 'resolved') {
    // This is a refresh - can implement background refresh logic
  }

  return await this.service.getData(params.id);
}
```

## Testing Considerations

### Handling Resource Loading in Tests

Resources trigger loading after component initialization. For most tests, the mock service should resolve immediately:

```typescript
const mockService = {
  getMember: vi.fn().mockResolvedValue(mockMember)
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
  getMember: vi.fn().mockReturnValue(pendingPromise)
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
    getMember: vi.fn().mockResolvedValue(mockMember)
  };

  await render(Component, {
    providers: [{ provide: MemberService, useValue: mockService }]
  });

  // Wait for resource to resolve
  expect(await screen.findByText(mockMember.name)).toBeVisible();
});
```

### Testing Status States

```typescript
it('should show reloading state during manual reload', async () => {
  const mockService = {
    getMember: vi.fn().mockResolvedValue(mockMember)
  };

  const { rerender } = await render(Component, {
    providers: [{ provide: MemberService, useValue: mockService }]
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
    updateProfile: vi.fn().mockRejectedValue(new Error('Update failed'))
  };

  await render(Component, {
    providers: [{ provide: ProfileService, useValue: mockService }]
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

### ❌ Calling loader function directly from class property

```typescript
// WRONG - Don't reference this.uid() in the loader
loader: async () => {
  return await this.service.getMember(this.uid());
}
```

### ✅ Use params passed to loader

```typescript
// CORRECT - Use params from loader argument
loader: async ({ params }) => {
  return await this.service.getMember(params.uid);
}
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
  loader: async ({ params }) => { /* ... */ }
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
    loader: async ({ params }) => {
      return await this.service.getData(params.id);
    },
  });

  protected data = this.dataResource.value;
  protected loading = this.dataResource.isLoading;
  protected error = computed(() => {
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
this.resource.update(current => ({ ...current, ...changes }));

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

| Feature | Purpose | Example |
|---------|---------|---------|
| `value()` | Get current data | `resource.value()?.name` |
| `hasValue()` | Type-safe value check | `if (resource.hasValue())` |
| `isLoading()` | Loading state check | `@if (resource.isLoading())` |
| `error()` | Get error object | `resource.error()?.message` |
| `status()` | Detailed state | `resource.status() === 'reloading'` |
| `reload()` | Manual refresh | `resource.reload()` |
| `set()` | Replace value | `resource.set(newValue)` |
| `update()` | Transform value | `resource.update(v => ({...v, ...changes}))` |

## Best Practices Checklist

- ✅ Use `@let` to extract resource at top of template (`@let resource = service.resource`)
- ✅ Use second `@let` to extract value (`@let data = resource.value()`)
- ✅ Check `resource.isLoading()`, `resource.error()`, or `data` for rendering logic
- ✅ Pass `abortSignal` to all async operations
- ✅ Return `undefined` from `params` for conditional loading
- ✅ Use `'reloading'` status for better UX during refreshes
- ✅ Implement optimistic updates with `.update()` + `.reload()` on error
- ✅ Expose resource directly to template (not individual signals)
- ❌ Don't read signals directly in loader (use `params`)
- ❌ Don't use `effect()` with resources (params handles reactivity)
- ❌ Don't manually manage loading/error states
- ❌ Don't repeat `service.resourceName` throughout template
