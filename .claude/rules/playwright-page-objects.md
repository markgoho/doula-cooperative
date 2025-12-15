---
paths: members/e2e/pages/*.page.ts
---

- page locators MUST use user-facing selectors like getByRole, getByLabelText, getByPlaceholderText, getByText, etc.
- do not use css classes for locators unless there is no other option available
- DO NOT try to add data-testid or other test-specific attributes to the production code. Use only user-facing selectors.
