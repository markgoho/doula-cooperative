---
paths: *.ts
---

## Variable Naming

**Use fully expressive variable names** that clearly communicate intent without abbreviations:

**Example**:

```typescript
// ✅ GOOD - Expressive, unambiguous names
const authorizationHeader = request.headers.authorization;
type TParameters = { userId: string; email: string };
const document = firestore.collection("users").doc(userId);

// ❌ BAD - Abbreviated or unclear names
const authHeader = request.headers.authorization;
type TParams = { userId: string; email: string };
const doc = firestore.collection("users").doc(userId); // ESLint: unicorn/prevent-abbreviations
```

## Function Return Types

**Always include explicit return types** on functions to improve type safety and documentation. Leave complex types inferred only when the explicit type becomes unwieldy:

**Example**:

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

// ✅ ACCEPTABLE - Complex inferred type
function transformData(input: ComplexType) {
  return {
    field1: input.a.b.c,
    field2: input.d.e.f.map(x => ({ ...x, computed: x.val * 2 })),
  };
}

// ❌ BAD - Missing return type when it's straightforward
async function getUserProfile({ userId }: { userId: string }) {
  const user = await fetchUser(userId);
  return user;
}
```

## Function Parameters

**Use a single object parameter** with named properties instead of multiple positional parameters. This improves readability and makes the function call self-documenting:

**Example**:

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

await sendEmail("user@example.com", "Welcome", "Hello!"); // What does each parameter mean?
```

## Optional Properties

**With `exactOptionalPropertyTypes: true`**, use spread operators to forward optional properties instead of passing potentially undefined values:

**Example**:

```typescript
// ✅ GOOD - Use spread operator for optional properties
const options = {
  required: "value",
  ...(optionalValue !== undefined && { optional: optionalValue }),
};

// ❌ BAD - Passing undefined violates exactOptionalPropertyTypes
const options = {
  required: "value",
  optional: optionalValue, // Error if optionalValue is undefined
};
```

## Module Structure

**Keep files short and focused** with a single responsibility. Typically, each file should export only one function:

**Example**:

```typescript
// ✅ GOOD - Single responsibility, one export
// send-welcome-email.ts
export function sendWelcomeEmail({ userEmail }: { userEmail: string }): Promise<void> {
  // Implementation
}

// ✅ GOOD - Direct re-export (satisfies unicorn/prefer-export-from)
// index.ts
export { sendWelcomeEmail } from "./send-welcome-email.js";

// ❌ BAD - Import then export
// index.ts
import { sendWelcomeEmail } from "./send-welcome-email.js";
export { sendWelcomeEmail };

// ❌ BAD - Multiple unrelated functions in one file
// email-utils.ts
export function sendWelcomeEmail(...) { }
export function sendResetPasswordEmail(...) { }
export function sendNotificationEmail(...) { }
```

## Type Definitions

**Declare explicit types** for all objects and avoid inline types. This improves reusability and makes types easier to maintain:

**Example**:

```typescript
// ✅ GOOD - Explicit, named type
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

// ❌ BAD - Object without explicit type
const config = {
  apiKey: process.env.API_KEY,
  timeout: 5000,
}; // Type is inferred, not explicit
```

## Error Types

**Use `TypeError` for type validation errors** instead of generic `Error`. This provides better semantic meaning and satisfies the `unicorn/prefer-type-error` ESLint rule:

**Example**:

```typescript
// ✅ GOOD - TypeError for type validation
function processValue(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError(`Expected string, got ${typeof value}`);
  }
  return value;
}

// ✅ GOOD - TypeError for missing required properties
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
    throw new Error(`Expected string, got ${typeof value}`); // ESLint: unicorn/prefer-type-error
  }
  return value;
}

// ✅ GOOD - Error for non-type-related issues
async function fetchUser(userId: string): Promise<User> {
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`); // Not a type issue
  }
  return response.json();
}
```

**When to use each error type**:

- `TypeError`: Type checks (`typeof`, `instanceof`), missing properties, invalid type conversions
- `Error` (or custom subclasses): Business logic errors, network failures, validation errors (non-type)

## ESLint Rules

**NEVER disable ESLint or TypeScript rules** globally for a file. If a rule is triggering, reconsider your approach or use a more specific local suppression with a comment explaining why:

**Example**:

```typescript
// ✅ GOOD - Fix the issue instead of disabling the rule
const authorizationHeader = request.headers.authorization;

// ✅ ACCEPTABLE - Specific suppression with justification
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- External library has untyped API
const result = externalLib.call() as any;

// ❌ BAD - Disabling rules globally
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable unicorn/prevent-abbreviations */
```
