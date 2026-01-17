# E2E Testing Patterns

This document codifies patterns and best practices for e2e tests in this project.

## Mocking External Firebase Functions

When testing UI behavior that calls Firebase Functions requiring external APIs (like MailerLite, Stripe, etc.), you have several options:

### Option 1: Skip Tests Requiring External APIs (Recommended for Most Cases)

```typescript
test.skip('test requiring external API', async ({ authenticatedPage }) => {
  // Mark test as skipped with clear TODO comment
  // TODO: This test requires MAILERLITE_API_KEY. Test via:
  // 1. Unit tests with mocked MailerLite API
  // 2. Manual testing in staging/production
  // 3. Integration tests with test API keys in CI
});
```

**When to use**: External services that require API keys, payment processing, email sending, etc.

### Option 2: Mock Network Responses with Playwright Route Interception

For testing UI behavior without calling real Firebase Functions:

```typescript
test('test with mocked Firebase function', async ({ authenticatedPage }) => {
  // Set up route mock BEFORE page interactions
  await authenticatedPage.route(
    (url) => url.href.includes('functionName'),
    async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();

      // Return mock response matching Firebase callable format
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            // Your mock data here
            success: true,
            data: postData.data, // Echo back request data if needed
          },
        }),
      });
    },
  );

  // Now interact with page - calls to functionName will be mocked
});
```

**Important**:

- Set up route **before** any page interactions
- Use function matcher `(url) => url.href.includes('functionName')` for reliability
- Match Firebase callable response format: `{ result: { ...yourData } }`

**When to use**: Testing UI state changes, loading states, error handling without external dependencies.

### Option 3: Test Mode in Firebase Functions (RECOMMENDED)

Add automatic emulator detection to your Firebase Function that bypasses external APIs:

```typescript
export const myFunction = onCall(async (request) => {
  // Check if running in emulator - skip external API calls in test environment
  const isEmulator = !!process.env['FUNCTIONS_EMULATOR'];
  if (isEmulator) {
    logger.info('Running in emulator - skipping external API call');
    // Update Firestore directly without calling external service
    await updateDatabase(request.data);
    return { success: true };
  }

  // Real implementation with external APIs (production only)
  const API_KEY = process.env['EXTERNAL_API_KEY'];
  await externalApiCall(API_KEY, request.data);
  await updateDatabase(request.data);
  return { success: true };
});
```

**When to use**: When you need to test the full Firebase Function flow but want to avoid external API calls (e.g., email services, payment APIs).

**Example**: The `updateNewsletterPreference` function uses this pattern to skip MailerLite API calls in the emulator while still updating Firestore.

### Option 4: Direct Firestore Manipulation

For testing UI updates based on Firestore data:

```typescript
test('test with direct Firestore update', async ({ authenticatedPage }) => {
  const membershipPage = new MembershipPage(authenticatedPage);
  await membershipPage.waitForAccountDetails();

  // Directly update Firestore via emulator API
  await createMemberDocument({
    uid: 'test-uid',
    newsletterSubscribed: true,
  });

  // Reload page to see updated data
  await authenticatedPage.reload();
  await expect(membershipPage.newsletterToggle).toBeChecked();
});
```

**When to use**: Testing that UI correctly displays Firestore data changes, without testing the update mechanism itself.

## Angular App Startup in E2E Tests

The Angular dev server and Firebase emulators are automatically started by Playwright via the `webServer` configuration in `playwright.config.ts`:

```typescript
webServer: [
  {
    command: 'bun run emulators:e2e',  // Start emulators
    cwd: rootDirectory,                // Run from repo root
    url: 'http://localhost:9099',      // Wait for this to be ready
    timeout: 60_000,
  },
  {
    command: 'bun run angular:start',  // Start Angular only
    cwd: rootDirectory,                // Run from repo root (script handles cd internally)
    url: 'http://localhost:4200',      // Wait for this to be ready
    timeout: 120_000,
  },
],
```

**Important**:

- Do NOT use `bun run start` as it starts emulators + Angular + Hugo + Functions watch, causing port conflicts since emulators are started separately
- The `angular:start` script is defined in root package.json and internally does `cd members && bun start`

## Firebase Emulator URLs

Firebase Functions in the emulator use this URL pattern:

```
http://localhost:5001/<project-id>/<region>/<function-name>
```

For this project: `http://localhost:5001/doula-cooperative/us-central1/functionName`

## Page Object Model Pattern

Always use Page Object Model to encapsulate locators and actions:

```typescript
// Good
const membershipPage = new MembershipPage(page);
await membershipPage.toggleNewsletter();

// Bad
await page.locator('.newsletter-preference input').click();
```

## Test Data Patterns

Use fixture customization for different test scenarios:

```typescript
test.use({
  testMemberDocument: {
    membershipActive: false,
    membershipExpiresAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
  },
});

test('expired member sees renewal prompt', async ({ authenticatedPage }) => {
  // Test will use customized member data
});
```

## Authentication Testing

For testing auth-protected routes, use two approaches:

### Authenticated Tests

Use the `authenticatedPage` fixture which handles sign-in automatically:

```typescript
test('authenticated user feature', async ({ authenticatedPage }) => {
  // User is already signed in and on /membership
});
```

### Unauthenticated Tests

Use the base Playwright `test` and clear auth state:

```typescript
base('unauthenticated redirect', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/membership');
  await expect(page).toHaveURL('/sign-in');
});
```

## Testing Checklist

Before marking an e2e test complete, verify:

- [ ] Uses Page Object Model
- [ ] Sets up mocks before page interactions
- [ ] Tests both success and error states
- [ ] Verifies data persistence (reload page)
- [ ] Uses accessibility-first selectors (roles, labels)
- [ ] Includes clear comments explaining mocking strategy
- [ ] Cleans up test data (fixtures handle this automatically)
