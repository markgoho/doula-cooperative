---
paths:
  - "*.html"
---

- use semantic elements where appropriate
- do not nest elements unnecessarily
- do not add wrapper elements purely for styling — use `:host` in the component's SCSS instead
- when writing e2e and unit tests, we'll use accessible queries to select elements, so make sure all elements that contain user-facing content are semantic and have accessible roles (usually native roles)
