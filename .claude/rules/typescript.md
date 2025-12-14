---
paths: *.ts
---

- use expressive variable names, e.g., `authorizationHeader` instead of `authHeader`, and `TParameters` instead of `TParams`.
- wherever possible, include a function return type on all functions, where this gets complex, you can leave the return type inferred
- do not use multiple function parameters, instead use a single object parameter with named properties
- with `exactOptionalPropertyTypes: true`, use spread operators to forward optional properties: `...(value !== undefined && { key: value })` instead of passing `{ key: value }` where value may be undefined
- use direct re-exports (`export { foo } from "./foo.js"`) instead of import-then-export to satisfy `unicorn/prefer-export-from` rule
- files should be short in length and have a single responsibility, typically only exporting a single function
- UNDER NO CIRCUMSTANCES should you disable any eslint or typescript rules globally for a file
