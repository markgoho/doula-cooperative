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
