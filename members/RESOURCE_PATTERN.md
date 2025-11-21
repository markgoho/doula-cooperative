# Angular Resource API Pattern

This document describes the correct pattern for using Angular's `resource` API for reactive async data loading (Angular 21+).

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
  - `abortSignal`: For request cancellation
  - `previous`: Status information from the previous load

### Exposed Resource Signals

- `resource.value()`: The loaded data (or `undefined` if not loaded)
- `resource.isLoading()`: Boolean loading state
- `resource.error()`: Error object if load failed (or `undefined`)
- `resource.status()`: Current resource status
- `resource.reload()`: Method to manually trigger a reload

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
  private memberResource = resource({
    params: () => ({ uid: this.uid() }),
    loader: async ({ params, abortSignal }) => {
      return await this.memberService.getMember(params.uid, { signal: abortSignal });
    },
  });

  // Expose resource signals for template
  protected member = this.memberResource.value;
  protected loading = this.memberResource.isLoading;

  // Transform error to string for display
  protected error = computed(() => {
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

```html
@if (loading()) {
  <p>Loading...</p>
} @else if (error(); as errorMessage) {
  <p class="error">{{ errorMessage }}</p>
} @else if (member(); as data) {
  <div>{{ data.name }}</div>
}
```

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

When `params` returns `undefined`, the loader doesn't run.

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
