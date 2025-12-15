---
paths: *.ts
---

# TypeScript Strict Mode Rules

This codebase uses extremely strict TypeScript and ESLint configurations. Follow these rules to write compliant code.

## TypeScript Compiler Strict Options

### `noUncheckedIndexedAccess: true`

Array and object index access returns `T | undefined`, not `T`:

```typescript
// ✅ GOOD - Handle potential undefined
const items = ["a", "b", "c"];
const first = items[0];
if (first !== undefined) {
  console.log(first.toUpperCase()); // Safe
}

// ✅ GOOD - Use non-null assertion only when certain
const item = items[0]!; // Only if you've verified the array has elements

// ❌ BAD - Assumes index exists
const items = ["a", "b", "c"];
console.log(items[0].toUpperCase()); // Error: Object is possibly 'undefined'

// ✅ GOOD - For objects with index signatures, use optional chaining
const record: Record<string, string> = { key: "value" };
const value = record["key"]; // Type is string | undefined
if (value) {
  console.log(value);
}
```

### `exactOptionalPropertyTypes: true`

Optional properties cannot be explicitly set to `undefined`:

```typescript
type Options = {
  required: string;
  optional?: string;
};

// ✅ GOOD - Omit the property or use spread
const options1: Options = { required: "value" };
const options2: Options = {
  required: "value",
  ...(maybeValue !== undefined && { optional: maybeValue }),
};

// ❌ BAD - Cannot assign undefined to optional property
const options: Options = {
  required: "value",
  optional: undefined, // Error with exactOptionalPropertyTypes
};

// ✅ GOOD - Conditional spread for optional properties
function buildOptions(input?: string): Options {
  return {
    required: "value",
    ...(input !== undefined && { optional: input }),
  };
}

// ❌ BAD - Direct assignment of possibly undefined value
function buildOptions(input?: string): Options {
  return {
    required: "value",
    optional: input, // Error if input is undefined
  };
}
```

### `noPropertyAccessFromIndexSignature: true`

Use bracket notation for index signature properties:

```typescript
type Config = {
  [key: string]: string;
};

const config: Config = { apiKey: "123" };

// ✅ GOOD - Bracket notation for index signature
const key = config["apiKey"];

// ❌ BAD - Dot notation on index signature
const key = config.apiKey; // Error: use ["apiKey"] instead

// This applies to Firebase custom claims, environment variables, etc.
const isAdmin = decodedToken["admin"] === true;
const apiKey = process.env["API_KEY"];
```

### `noImplicitReturns: true`

All code paths must return a value:

```typescript
// ✅ GOOD - All paths return
function getValue(condition: boolean): string {
  if (condition) {
    return "yes";
  }
  return "no";
}

// ❌ BAD - Missing return in else branch
function getValue(condition: boolean): string {
  if (condition) {
    return "yes";
  }
  // Error: Not all code paths return a value
}
```

### `noUnusedLocals: true` and `noUnusedParameters: true`

No unused variables or parameters:

```typescript
// ✅ GOOD - Use underscore prefix for intentionally unused
function handler(_event: Event, data: Data): void {
  console.log(data);
}

// ✅ GOOD - Destructure to exclude unused properties
const { unusedProperty: _, ...rest } = object;

// ❌ BAD - Unused variable
const unused = getValue(); // Error: 'unused' is declared but never used
```

### `verbatimModuleSyntax: true`

Use explicit `type` imports for type-only imports:

```typescript
// ✅ GOOD - Explicit type import
import type { UserProfile } from "./types.js";
import { createUser, type CreateUserOptions } from "./user.js";

// ❌ BAD - Importing type without 'type' keyword
import { UserProfile } from "./types.js"; // Error if UserProfile is only a type
```

## Variable Naming (unicorn/prevent-abbreviations)

**Use fully expressive variable names.** Common abbreviations that trigger errors:

| Abbreviation | Use Instead |
|-------------|-------------|
| `e`, `err` | `error` |
| `res` | `response` or `result` |
| `req` | `request` |
| `msg` | `message` |
| `btn` | `button` |
| `cb` | `callback` |
| `ctx` | `context` |
| `doc` | `document` |
| `el` | `element` |
| `env` | `environment` |
| `fn` | `function` |
| `i`, `j`, `k` | `index` (or descriptive name) |
| `len` | `length` |
| `lib` | `library` |
| `num` | `number` |
| `obj` | `object` |
| `opts` | `options` |
| `param`, `params` | `parameter`, `parameters` |
| `prev` | `previous` |
| `prop`, `props` | `property`, `properties` |
| `ref` | `reference` |
| `str` | `string` |
| `temp`, `tmp` | `temporary` (or descriptive name) |
| `val` | `value` |
| `arg`, `args` | `argument`, `arguments` |
| `attr` | `attribute` |
| `auth` | `authorization` or `authentication` |
| `config` | (allowed - keep as is) |

```typescript
// ✅ GOOD
const authorizationHeader = request.headers.authorization;
const documentReference = firestore.collection("users").doc(userId);
for (const [index, item] of items.entries()) { }
const errorMessage = error.message;

// ❌ BAD
const authHeader = request.headers.authorization;
const docRef = firestore.collection("users").doc(userId);
for (let i = 0; i < items.length; i++) { }
const errMsg = error.message;
```

## Null vs Undefined (unicorn/no-null)

**Prefer `undefined` over `null`.** Only use `null` when required by external APIs:

```typescript
// ✅ GOOD - Use undefined
function findUser(id: string): User | undefined {
  const user = users.get(id);
  return user;
}

// ✅ ACCEPTABLE - null required by external API (with eslint-disable)
// eslint-disable-next-line unicorn/no-null -- Stripe API requires null
const stripeField = null;

// ❌ BAD - Using null when undefined would work
function findUser(id: string): User | null {
  return users.get(id) ?? null;
}
```

## Function Return Types

**Always include explicit return types** on functions:

```typescript
// ✅ GOOD - Explicit return type
async function getUserProfile({
  userId,
}: {
  userId: string;
}): Promise<UserProfile> {
  const user = await fetchUser(userId);
  return user;
}

// ✅ ACCEPTABLE - Complex inferred type (only when explicit type is unwieldy)
function transformData(input: ComplexType) {
  return {
    field1: input.a.b.c,
    field2: input.d.e.f.map(x => ({ ...x, computed: x.value * 2 })),
  };
}

// ❌ BAD - Missing return type
async function getUserProfile({ userId }: { userId: string }) {
  const user = await fetchUser(userId);
  return user;
}
```

## Function Parameters

**Use a single object parameter** with named properties:

```typescript
// ✅ GOOD - Single object parameter
function sendEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  // Implementation
}

await sendEmail({
  to: "user@example.com",
  subject: "Welcome",
  body: "Hello!",
});

// ❌ BAD - Multiple positional parameters
function sendEmail(to: string, subject: string, body: string): Promise<void> {
  // Implementation
}
```

## Module Structure (unicorn/prefer-export-from)

**One export per file, use re-exports in index files:**

```typescript
// ✅ GOOD - Single responsibility
// send-welcome-email.ts
export function sendWelcomeEmail({ userEmail }: { userEmail: string }): Promise<void> {
  // Implementation
}

// ✅ GOOD - Direct re-export
// index.ts
export { sendWelcomeEmail } from "./send-welcome-email.js";

// ❌ BAD - Import then export
// index.ts
import { sendWelcomeEmail } from "./send-welcome-email.js";
export { sendWelcomeEmail };
```

## Array Methods (unicorn/prefer-*)

**Use modern array methods:**

```typescript
// ✅ GOOD - Use .find() for single element
const user = users.find(u => u.id === targetId);

// ❌ BAD - Use .filter()[0]
const user = users.filter(u => u.id === targetId)[0];

// ✅ GOOD - Use .includes()
if (allowedValues.includes(value)) { }

// ❌ BAD - Use .indexOf() !== -1
if (allowedValues.indexOf(value) !== -1) { }

// ✅ GOOD - Use .some() or .every()
const hasAdmin = users.some(u => u.isAdmin);
const allValid = items.every(item => item.isValid);

// ❌ BAD - Use .filter().length
const hasAdmin = users.filter(u => u.isAdmin).length > 0;

// ✅ GOOD - Use .at() for negative indices
const last = items.at(-1);

// ❌ BAD - Use [array.length - 1]
const last = items[items.length - 1];

// ✅ GOOD - Use for...of for iteration
for (const item of items) {
  console.log(item);
}

// ❌ BAD - Use traditional for loop
for (let i = 0; i < items.length; i++) {
  console.log(items[i]);
}
```

## String Methods (unicorn/prefer-*)

```typescript
// ✅ GOOD - Use .startsWith() / .endsWith()
if (filename.endsWith(".ts")) { }
if (path.startsWith("/api/")) { }

// ❌ BAD - Use .indexOf() === 0 or slice
if (filename.slice(-3) === ".ts") { }
if (path.indexOf("/api/") === 0) { }

// ✅ GOOD - Use .replaceAll() for global replace
const cleaned = text.replaceAll("-", "_");

// ❌ BAD - Use .replace() with global regex
const cleaned = text.replace(/-/g, "_");

// ✅ GOOD - Use template literals
const message = `Hello, ${name}!`;

// ❌ BAD - String concatenation
const message = "Hello, " + name + "!";
```

## Error Handling (unicorn/prefer-type-error)

**Use `TypeError` for type validation errors:**

```typescript
// ✅ GOOD - TypeError for type checks
function processValue(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError(`Expected string, got ${typeof value}`);
  }
  return value;
}

// ✅ GOOD - TypeError for missing properties
function validateConfig(config: unknown): Config {
  if (typeof config !== "object" || config === null) {
    throw new TypeError("Config must be an object");
  }
  if (!("apiKey" in config)) {
    throw new TypeError("Config missing required property: apiKey");
  }
  return config as Config;
}

// ❌ BAD - Generic Error for type checks
function processValue(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string, got ${typeof value}`);
  }
  return value;
}

// ✅ GOOD - Error for non-type issues
async function fetchUser(userId: string): Promise<User> {
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }
  return response.json() as Promise<User>;
}
```

## Error Message Requirements (unicorn/error-message)

**Always provide error messages:**

```typescript
// ✅ GOOD - Error with message
throw new Error("Failed to connect to database");
throw new TypeError("Expected number, got string");

// ❌ BAD - Error without message
throw new Error();
throw new TypeError();
```

## Type Definitions

**Declare explicit named types:**

```typescript
// ✅ GOOD - Named type
type UserProfile = {
  userId: string;
  email: string;
  displayName: string;
};

function updateProfile({ profile }: { profile: UserProfile }): Promise<void> {
  // Implementation
}

// ❌ BAD - Inline type definition
function updateProfile({
  profile,
}: {
  profile: {
    userId: string;
    email: string;
    displayName: string;
  };
}): Promise<void> {
  // Implementation
}
```

## Filename Case (unicorn/filename-case)

**Use kebab-case for filenames:**

```typescript
// ✅ GOOD
user-profile.ts
send-email.ts
auth-service.ts
http-error.ts

// ❌ BAD
userProfile.ts
UserProfile.ts
send_email.ts
```

## Node.js Imports (unicorn/prefer-node-protocol)

**Use `node:` protocol for Node.js built-ins:**

```typescript
// ✅ GOOD
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Buffer } from "node:buffer";

// ❌ BAD
import { readFile } from "fs/promises";
import { join } from "path";
```

## Strict Boolean Expressions (@typescript-eslint/strict-boolean-expressions)

**Be explicit in boolean contexts:**

```typescript
// ✅ GOOD - Explicit checks
if (value !== undefined) { }
if (value !== null) { }
if (value !== "") { }
if (value !== 0) { }
if (array.length > 0) { }

// ❌ BAD - Implicit truthy/falsy
if (value) { } // What if value is 0 or ""?
if (array.length) { }
```

## No Unnecessary Conditions (@typescript-eslint/no-unnecessary-condition)

**Don't check conditions that are always true/false:**

```typescript
// Given: value: string (not string | undefined)

// ❌ BAD - Unnecessary check
if (value !== undefined) { // Always true - value can't be undefined
  console.log(value);
}

// ✅ GOOD - Just use the value
console.log(value);
```

## No Unsafe Any (@typescript-eslint/no-unsafe-*)

**Avoid `any` type, use `unknown` for truly unknown types:**

```typescript
// ✅ GOOD - Use unknown and narrow
function processData(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (typeof data === "object" && data !== null && "message" in data) {
    return String((data as { message: unknown }).message);
  }
  return String(data);
}

// ❌ BAD - Using any
function processData(data: any): string {
  return data.message; // Unsafe member access
}
```

## Restrict Template Expressions (@typescript-eslint/restrict-template-expressions)

**Only allowed types in template literals** (configured to allow numbers and booleans):

```typescript
// ✅ GOOD - Allowed types
const message = `Count: ${count}`; // number allowed
const status = `Active: ${isActive}`; // boolean allowed
const greeting = `Hello, ${name}`; // string

// ❌ BAD - Object in template
const info = `User: ${user}`; // Error: object not allowed
// Fix:
const info = `User: ${user.name}`;
const info = `User: ${JSON.stringify(user)}`;
```

## Consistent Type Assertions

**Use `as` syntax, not angle brackets:**

```typescript
// ✅ GOOD
const value = someValue as string;

// ❌ BAD
const value = <string>someValue;
```

## No Non-Null Assertion Abuse

**Prefer proper null checks over `!`:**

```typescript
// ✅ GOOD - Proper null check
const user = users.find(u => u.id === id);
if (user) {
  console.log(user.name);
}

// ✅ ACCEPTABLE - When you've verified the condition
const items = [1, 2, 3];
if (items.length > 0) {
  const first = items[0]!; // Safe - we know array has elements
}

// ❌ BAD - Blind assertion
const user = users.find(u => u.id === id)!;
console.log(user.name); // Crashes if user not found
```

## ESLint Rule Disabling

**NEVER disable rules globally. Use specific line suppressions with justification:**

```typescript
// ✅ ACCEPTABLE - Specific suppression with reason
// eslint-disable-next-line unicorn/no-null -- Stripe API requires null
const field = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- External library has incomplete types
const result = externalLib.call() as any;

// ❌ BAD - Global file disables
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable unicorn/prevent-abbreviations */
```

## Switch Statement Exhaustiveness

**Handle all cases or add default:**

```typescript
type Status = "pending" | "active" | "inactive";

// ✅ GOOD - Exhaustive switch
function getStatusLabel(status: Status): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
  }
}

// ✅ GOOD - Use object lookup instead of switch (preferred)
const statusLabels: Record<Status, string> = {
  pending: "Pending",
  active: "Active",
  inactive: "Inactive",
};
const label = statusLabels[status];
```

## Promises and Async

```typescript
// ✅ GOOD - Proper async/await
async function fetchData(): Promise<Data> {
  const response = await fetch("/api/data");
  return response.json() as Promise<Data>;
}

// ❌ BAD - Unnecessary await on return (in some contexts)
async function getValue(): Promise<string> {
  return await Promise.resolve("value"); // Unnecessary await
}

// ✅ GOOD - Direct return of promise
async function getValue(): Promise<string> {
  return Promise.resolve("value");
}

// ❌ BAD - Promise.all with single promise
await Promise.all([singlePromise]); // unicorn/no-single-promise-in-promise-methods

// ✅ GOOD - Just await the single promise
await singlePromise;
```

## Number Handling (unicorn/prefer-number-properties)

```typescript
// ✅ GOOD - Use Number methods
Number.isNaN(value);
Number.isFinite(value);
Number.parseInt(str, 10);
Number.parseFloat(str);

// ❌ BAD - Global functions
isNaN(value);
isFinite(value);
parseInt(str, 10);
parseFloat(str);
```

## Spread Over Object.assign (unicorn/prefer-spread)

```typescript
// ✅ GOOD - Spread syntax
const merged = { ...defaults, ...overrides };
const copy = [...array];

// ❌ BAD - Object.assign
const merged = Object.assign({}, defaults, overrides);
```

## Ternary Expressions (unicorn/no-nested-ternary)

**No nested ternaries:**

```typescript
// ✅ GOOD - If/else or early return
function getLabel(status: Status): string {
  if (status === "active") {
    return "Active";
  }
  if (status === "pending") {
    return "Pending";
  }
  return "Unknown";
}

// ❌ BAD - Nested ternary
const label = status === "active" ? "Active" : status === "pending" ? "Pending" : "Unknown";
```
