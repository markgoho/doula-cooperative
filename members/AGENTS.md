# AGENTS.md

This file provides guidance to AI assistants when working with code in this repository.

**Note:** See root `AGENTS.md` for monorepo-wide guidance, build commands, and integration points.

## Project Overview

This is an Angular application for the Doula Cooperative member portal. It uses Firebase for authentication, Firestore for data storage, and integrates with Firebase Cloud Functions (located in the sibling `../functions` directory).

The application uses Angular's **zoneless change detection** and modern Angular features including signals, standalone components, and Testing Library for component tests.

## Build and Development Commands

**Package Manager:** This project uses **Bun** (not npm or yarn). While `package.json` scripts use standard `ng` commands, always run them with `bun` (e.g., `bun run build`).

### Development

```bash
bun install      # Install dependencies
bun start        # Start dev server at http://localhost:4200
bun run watch    # Build with watch mode
```

### Testing

#### Unit Tests

Tests use **Vitest** with Angular CLI (not Karma/Jest):

```bash
bun test                                   # Run all tests in watch mode
bun test --watch=false                     # Run all tests once
bun test --watch=false --reporter=verbose  # Run with verbose output
```

To run a single test file:

```bash
ng test --include="**/header.spec.ts" --watch=false
```

**Note:** The project uses Angular's experimental unit test builder with Vitest. Use `ng test` commands rather than `bun vitest` directly.

#### E2E Tests

E2E tests use **Playwright** and require Firebase emulators:

```bash
bun run e2e                    # Run all e2e tests
bun run e2e --ui               # Run with Playwright UI
bun run e2e --debug            # Run in debug mode
bun run e2e <test-file-name>   # Run specific test file
```

**Prerequisites:**

- Firebase emulators must be configured (see `firebase.json`)
- Playwright browsers must be installed: `npx playwright install`
- E2E tests are located in `e2e/tests/` directory
- Page objects are in `e2e/pages/` for reusable selectors

**When to write E2E tests:**

- REQUIRED for admin features that modify data (create, update, delete operations)
- REQUIRED for user flows involving API calls
- Test both success and error scenarios
- Test user interactions (button clicks, form submissions, confirmations)
- Verify navigation after operations complete

**E2E test structure:**

```typescript
test('feature description', async ({ authenticatedAdminPage }) => {
  // Mock API endpoints
  await authenticatedAdminPage.route('**/api/path', async (route) => {
    /* ... */
  });

  // Navigate and interact
  const page = new PageObject(authenticatedAdminPage);
  await page.goto();
  await page.performAction();

  // Verify results
  await expect(page.element).toBeVisible();
});
```

### Production Build

```bash
bun run build  # Build for production (outputs to dist/)
```

### Linting

```bash
bun run lint  # Run ESLint on TypeScript and HTML files
```

**Note:** You can also run `bun run lint` from the project root to lint all apps in the monorepo.

### Prettier Configuration

Prettier is configured in package.json:

- `printWidth: 100`
- `singleQuote: true`
- HTML files use Angular parser

## Architecture

### Application Structure

The app uses **standalone components** (no NgModules) with the following structure:

```
src/app/
├── app.ts              # Root component
├── app.config.ts       # Application providers and Firebase config
├── app.routes.ts       # Routing configuration
├── services/           # Core services
│   ├── auth.service.ts      # Firebase Auth operations
│   ├── membership.service.ts # Membership data and status
│   ├── profile.service.ts   # Profile management
│   └── window.token.ts      # Window object injection token
└── [components]/       # Feature components (sign-in, sign-up, etc.)
```

### Key Services

**AuthService** (`src/app/services/auth.service.ts`):

- Manages Firebase authentication operations (sign up, sign in, sign out)
- Provides reactive user state via signals: `user()`, `emailVerified()`
- Handles email verification, password reset flows
- Automatically preloads user profiles on authentication
- All auth errors are mapped to user-friendly messages in `AUTH_ERROR_MESSAGES`

**MembershipService** (`src/app/services/membership.service.ts`):

- Manages member document data from Firestore `members` collection
- Provides reactive signals: `membershipActive()`, `hasProfile()` (derived from `slug` presence)
- Handles profile claiming flow from `migrated_users_import` collection

**ProfileService** (`src/app/services/profile.service.ts`):

- Fetches and caches profile content via `readProfile` cloud function
- Profile data is cached and only fetched once per session

### Firebase Integration

**Configuration** (`src/app/app.config.ts`):

- Firebase emulators are **automatically connected in development mode** (`isDevMode()`)
- Auth emulator: `http://localhost:9099`
- Firestore emulator: `localhost:8080`
- Functions emulator: `localhost:5001`
- Production Firebase config is hardcoded in app.config.ts

**Collections:**

- `members` - Primary user collection keyed by Firebase Auth UID
- `migrated_users_import` - Pre-imported profiles keyed by email (deleted after claim)

### Routing and Guards

**Routes** (`src/app/app.routes.ts`):

- Protected routes use `@angular/fire/auth-guard` with `canActivate`
- `redirectUnauthorizedToSignIn` - Redirects unauthenticated users to `/sign-in`
- `redirectToMembership` - Redirects authenticated users away from auth pages
- Route bindings use `withComponentInputBinding()` to pass query params as component inputs

**Key Routes:**

- `/sign-in`, `/sign-up` - Authentication flows (redirect if already logged in)
- `/membership` - Main dashboard (requires authentication)
- `/profile` - Profile editing (requires authentication and active membership)
- `/auth-actions` - Firebase Auth action handler (email verification, password reset)

### Component Naming Convention

Components use **PascalCase class names without "Component" suffix**:

- `Header` not `HeaderComponent`
- `SignIn` not `SignInComponent`

### TypeScript Configuration

Strict TypeScript settings are enabled:

- `strict: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`
- `strictTemplates: true` for Angular templates

### ESLint Configuration

Uses ESLint (not TSLint) with:

- `@angular-eslint` - Angular-specific rules
- `typescript-eslint` - TypeScript rules
- `eslint-plugin-unicorn` - Additional code quality rules

**Important customizations:**

- `unicorn/consistent-function-scoping.checkArrowFunctions: false` - Allows arrow functions in signals and reactive contexts
- `unicorn/no-useless-undefined.checkArguments: false` - Allows explicit undefined in function arguments
- Component selector prefix: `app-`
- SCSS is the style language (not CSS)

## Testing Guidelines

### Test Framework

Tests use **@testing-library/angular** with **Vitest** (not Karma or Jest).

**Setup files:**

- `src/test-setup.ts` - Imports `@testing-library/jest-dom/vitest` matchers
- `src/test-providers.ts` - Default test providers (zoneless change detection)

### Test File Patterns

**Unit tests** (`*.spec.ts`):

- Located next to the component/service being tested
- Use a `setup()` function that returns the rendered component with mocked dependencies
- Setup function accepts an options object with semantic parameters (e.g., `isAuthenticated`, `isEmailVerified`)
- Setup function uses object destructuring with default values
- Mock services use `signal()` for reactive properties
- Always use explicit assertions about element visibility and document presence

**Integration tests** (`*.integration.spec.ts`):

- Test navigation flows and multi-component interactions
- Use mock route components and `provideRouter()` with real routing
- Access router via `view.fixture.debugElement.injector.get(Router)`
- Navigate using `router.navigateByUrl()` followed by `view.fixture.detectChanges()`

### Critical Test Requirements

**Setup Function Pattern:**
All tests MUST use a setup function that follows this pattern:

```typescript
interface SetupOptions {
  isAuthenticated?: boolean;
  isEmailVerified?: boolean;
  // ... other semantic options
}

async function setup({ isAuthenticated = false, isEmailVerified = false }: SetupOptions = {}) {
  // Create mocks based on semantic options
  const mockAuthService = {
    user: signal(isAuthenticated ? { emailVerified: isEmailVerified } : null),
  };

  return await render(Component, {
    providers: [{ provide: AuthService, useValue: mockAuthService }],
  });
}
```

**Assertions:**

- ALWAYS assert visibility: `expect(element).toBeVisible()` or `expect(element).not.toBeInTheDocument()`
- NEVER use `toBeTruthy()` or `toBeFalsy()` on DOM elements
- Use `waitFor()` for async operations that affect the DOM
- Use `screen.getByRole()` for accessibility-first queries

**Mock Service Properties:**

- Use `signal()` for reactive properties like `user`, `emailVerified`, `membershipActive`
- Use `vi.fn().mockResolvedValue()` for async methods
- Use `vi.fn().mockImplementation()` when behavior depends on parameters

### Common Test Patterns

**Mocking AuthService:**

```typescript
const mockAuthService = {
  user: signal(mockUser),
  emailVerified: signal(true),
  signInWithEmail: vi.fn().mockResolvedValue({}),
  signOut: vi.fn().mockResolvedValue(undefined),
};
```

**Mocking MembershipService:**

```typescript
const mockMembershipService = {
  membershipActive: signal(true),
  hasProfile: signal(false),
  userDocument: signal({ uid: '123', email: 'user@example.com' }),
};
```

**Testing user interactions:**

```typescript
const user = userEvent.setup();
await user.type(screen.getByLabelText('Email'), 'test@example.com');
await user.click(screen.getByRole('button', { name: 'Submit' }));
```

### E2E Test Requirements

**IMPORTANT:** Admin features that modify data MUST have E2E tests.

**Required E2E tests for:**

- All admin CRUD operations (Create, Read, Update, Delete)
- User flows involving API calls
- Multi-step user interactions (confirmations, navigation)

**E2E test files:**

- Located in `e2e/tests/` directory
- Page objects in `e2e/pages/` for reusable selectors
- Follow existing comment patterns (e.g., `// === Verify results ===`)

**What to test:**

- Success scenarios with mocked API responses
- Error scenarios (404, 500, network errors)
- User confirmations (accept and reject)
- Navigation after operations
- Loading states and error messages

**Example E2E test structure:**

```typescript
test('admin performs action with confirmation', async ({ authenticatedAdminPage }) => {
  const mockData = {
    /* ... */
  };

  await authenticatedAdminPage.route('**/api/path', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      return;
    }
    await route.continue();
  });

  const page = new PageObject(authenticatedAdminPage);
  await page.goto();

  authenticatedAdminPage.on('dialog', (dialog) => dialog.accept());
  await page.actionButton.click();

  await expect(authenticatedAdminPage).toHaveURL(/\/expected-path$/);
});
```

### Component-Level Providers in Tests

When a component declares `providers: [SomeService]` in its `@Component` decorator, Angular creates a new instance at the component level. In tests, you **must** mock all of that service's dependencies in the test `providers` array, because the real service may still be instantiated during component creation.

Always ensure mock objects for upstream services (e.g., `mockAdminMembersService`) include **all methods** the real service calls — not just the ones under test. Missing methods cause `"is not a function"` errors at runtime.

```typescript
// ❌ Missing method that the real service calls internally
const mockAdminMembersService = {
  getUnclaimedProfile,
  sendInvitation,
};

// ✅ All methods present, even ones not directly under test
const mockAdminMembersService = {
  getUnclaimedProfile,
  sendInvitation,
  changeEmailAndResend: vi.fn().mockResolvedValue({ success: true }),
};
```

### Unit vs Integration Tests

Unit tests (`*.spec.ts`) should test **one unit of behavior** per test. Multi-step user flows (open form → fill → submit → verify navigation + success message) belong in e2e tests (`e2e/tests/*.spec.ts`) using Playwright.

For component methods that are `protected` (template-bound), access them via the component instance with a type cast:

```typescript
const instance = component.fixture.componentInstance as unknown as {
  myMethod(): Promise<void>;
};
await instance.myMethod();
```

## Important Patterns

### Web-Native Interaction Elements

**Prefer native HTML elements over JavaScript-based interaction patterns:**

- **Confirmations:** Use `<dialog>` elements instead of `window.confirm()` or `window.alert()`
- **Modals:** Use `<dialog>` elements with `showModal()` instead of custom modal implementations
- **Dropdowns:** Use native `<select>` or `<details>/<summary>` when appropriate
- **Date/Time:** Use native `<input type="date">` or `<input type="time">` inputs

**Benefits of web-native elements:**

- Better accessibility (built-in ARIA roles and keyboard navigation)
- Consistent browser behavior and styling
- Easier to test (no need to mock browser dialogs)
- Progressive enhancement (works without JavaScript)

**Dialog pattern example:**

```typescript
// Component
protected confirmDialog = viewChild<ElementRef<HTMLDialogElement>>('confirmDialog');

protected showConfirm(): void {
  this.confirmDialog()?.nativeElement.showModal();
}

protected closeDialog(): void {
  this.confirmDialog()?.nativeElement.close();
}
```

```html
<!-- Template -->
<dialog #confirmDialog class="confirm-dialog" aria-labelledby="dialog-title">
  <div class="dialog-content">
    <h3 id="dialog-title">Confirm Action</h3>
    <p>Are you sure you want to proceed?</p>
    <div class="dialog-actions">
      <button type="button" class="button button-secondary" (click)="closeDialog()">Cancel</button>
      <button type="button" class="button button-danger" (click)="confirmAction()">Confirm</button>
    </div>
  </div>
</dialog>
```

**E2E testing with dialogs:**

```typescript
// Open dialog
await page.deleteButton.click();

// Verify dialog is visible
const dialog = page.locator('dialog[open]');
await expect(dialog).toBeVisible();

// Interact with dialog
await dialog.getByRole('button', { name: /confirm/i }).click();

// Or cancel
await dialog.getByRole('button', { name: /cancel/i }).click();
```

### Zoneless Change Detection

The app uses `provideZonelessChangeDetection()` instead of Zone.js. This means:

- Components rely on signals and reactive primitives for change detection
- Manual `detectChanges()` calls are needed in tests after programmatic state changes
- Async operations should use signals or `toSignal()` to trigger change detection

### Signal Usage

Signals are the primary reactive primitive:

- Use `signal()` for writable state
- Use `computed()` for derived state
- Use `toSignal()` to convert Observables to signals
- Use `effect()` for side effects (rare, prefer reactive templates)

### Dependency Injection

- Use `inject()` function in constructors or class properties
- Services are `@Injectable({ providedIn: 'root' })` by default
- Custom injection tokens use `InjectionToken` (see `window.token.ts`)

### Profile Claiming Flow

1. User signs up and verifies email
2. UI checks if profile data exists in `migrated_users_import` (by email)
3. User clicks "Claim Profile" button
4. `AuthService.claimProfile()` calls Firebase function
5. Function merges profile data into `members` collection and deletes import document
6. `MembershipService` reactively updates `hasProfile()` signal

### Error Handling

- Auth errors are mapped to user-friendly messages in `AUTH_ERROR_MESSAGES`
- Service methods throw errors that components catch and display
- Use try-catch blocks in async operations
- Display error messages in UI (don't just console.error)

## Deployment

The app is deployed to Firebase Hosting via GitHub Actions (see `.github/workflows/members-hosting-merge.yml`).

- Production builds are automatically deployed on merges to `main` branch
- Build command: `bun run build` (outputs to `dist/`)
- Firebase configuration is in `../firebase.json`

## Relationship to Functions Directory

The sibling `../functions` directory contains Firebase Cloud Functions that this app calls:

- `claimProfile` - Claims pre-imported profile
- `readProfile` - Fetches profile content from GitHub

See `../functions/AGENTS.md` for details on the backend architecture.
