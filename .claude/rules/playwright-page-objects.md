---
paths: members/e2e/pages/*.page.ts
---

## Selector Strategy

**Always use user-facing selectors** that match how users interact with the page:

**Preferred selectors (in order)**:

1. `getByRole()` - Buttons, headings, links, dialogs, alerts, etc.
2. `getByLabelText()` / `getByLabel()` - Form fields with labels
3. `getByPlaceholderText()` - Input fields with placeholders
4. `getByText()` - Elements with specific text content

**Avoid unless no other option**:

- CSS class selectors (`.my-class`)
- HTML element selectors (`div`, `span`, `p`)

**Never use**:

- `data-testid` or other test-specific attributes in production code
- CSS selectors based on implementation details
- xpath selectors

**Example**:

```typescript
// ✅ GOOD - User-facing selectors
await page.getByRole("button", { name: "Delete User" }).click();
await expect(page.getByRole("alert")).toContainText("Error");
await page.getByLabel("Email").fill("user@example.com");

// ❌ BAD - Implementation-specific selectors
await page.locator(".delete-btn").click();
await expect(page.locator("div.error-message")).toBeVisible();
await page.locator('[data-testid="email-input"]').fill("user@example.com");
```

## When to Use Page Objects vs Ad-Hoc Selectors

**Use page objects for**:

- Locators that are reused across multiple tests
- Convenience methods that encapsulate multi-step workflows (e.g., `deleteUser()`, `login()`, `fillForm()`)
- Navigation methods (e.g., `goto()`, `waitForPageLoad()`)

**Use ad-hoc selectors directly in tests for**:

- One-off assertions that only appear in a single test
- Selectors that are specific to a particular test scenario
- Content verification that varies by test case

**Example**:

```typescript
// ✅ GOOD - Reused locator in page object
class AdminPage {
  readonly deleteButton = page.getByRole("button", { name: "Delete" });

  async deleteUser() {
    await this.deleteButton.click();
    await this.confirmDialog.getByRole("button", { name: "Confirm" }).click();
  }
}

test("deletes user", async ({ page }) => {
  const adminPage = new AdminPage(page);
  await adminPage.deleteUser(); // Convenience method

  // ✅ GOOD - One-off assertion directly in test
  await expect(page.getByText("User deleted successfully")).toBeVisible();
});

// ❌ BAD - Don't add one-off locators to page object
class AdminPage {
  readonly successMessage = page.getByText("User deleted successfully"); // Only used once
}
```

## Scoping with Angular Component Selectors

Use Angular component selectors to scope locators when multiple similar elements exist on the page:

```typescript
// ✅ GOOD - Scope to specific Angular component
const activeMembersTable = page.locator("app-active-members-table");
this.membersTable = activeMembersTable.getByRole("table");
this.loadingMessage = activeMembersTable.getByText("Loading members...");
this.errorMessage = activeMembersTable.getByText(/Failed to load/i);

// ❌ BAD - Ambiguous when page has multiple tables
this.membersTable = page.getByRole("table"); // Which table?
```

This is especially useful when a page has multiple sections with similar elements (e.g., admin dashboard with members table AND unclaimed profiles table).

## Known Issues with Angular Zoneless

**Click events in page object methods may not trigger Angular change detection** when using zoneless change detection (`provideZonelessChangeDetection()`).

If interactive actions like sorting don't work via page object methods, use inline locators directly in the test:

```typescript
// Page object method might not work with zoneless Angular
async sortBy(column: string) {
  await this.headerMap[column].click(); // Click may not trigger change detection
}

// Alternative: Use inline locator in test
test("sorts table", async ({ authenticatedAdminPage }) => {
  const table = authenticatedAdminPage.locator("app-members-table");
  const nameHeader = table.getByRole("columnheader", { name: /Name/ });
  await nameHeader.click();
  // Assertions...
});
```

This is a known limitation being investigated. When a page object action doesn't trigger the expected behavior, try the inline approach before assuming the feature is broken.
