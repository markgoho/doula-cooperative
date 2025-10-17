# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Firebase Functions project for the Doula Cooperative application. It provides serverless backend functionality including user management, profile operations, form handling, and email notifications via Mailgun.

## Build and Development Commands

### Build
```bash
npm run build        # Compile TypeScript to JavaScript
npm run build:watch  # Compile with watch mode
```

### Testing
Tests use Bun test runner (not Jest/npm). Run tests with:
```bash
bun test                                    # Run all tests
bun test test/claim-profile.test.ts         # Run specific test file
```

All test files are in the `test/` directory and use Firebase emulators (Firestore on 127.0.0.1:8080, Auth on 127.0.0.1:9099).

### Linting and Local Development
```bash
npm run lint    # Run ESLint
npm run serve   # Build and start Firebase emulators for functions
npm run shell   # Build and start Firebase functions shell
```

### Deployment
```bash
npm run deploy  # Deploy functions to Firebase
npm run logs    # View Firebase function logs
```

## Architecture

### Firebase Functions Structure

All functions are exported from `src/index.ts` with lazy imports using dynamic imports for each handler module. This pattern optimizes cold start performance.

**HTTP Endpoints (onRequest):**
- `contactUsForm` - Public endpoint for contact form submissions, writes to `messages` collection
- `doulaMatchForm` - Public endpoint for doula matching requests, writes to `matchRequests` collection

**Callable Functions (onCall):**
- `claimProfile` - Authenticated function to claim pre-imported profile from `import` collection
- `readProfile` - Authenticated function to fetch profile content from GitHub via Octokit

**Firestore Triggers (onDocumentCreated):**
- `emailContactForm` - Sends email via Mailgun when document created in `messages` collection
- `emailDoulaMatch` - Sends email via Mailgun when document created in `matchRequests` collection

**Auth Triggers:**
- `createMemberOnUserCreated` - Creates member document in `members` collection when Firebase Auth user created
- `deleteMemberOnUserDeleted` - Deletes member document when Firebase Auth user deleted

### Key Collections

- `members` - Primary user collection, keyed by Firebase Auth UID. Contains membership status, profile slugs, subscription dates
- `import` - Temporary collection for pre-imported profiles keyed by email, deleted after claim
- `messages` - Contact form submissions
- `matchRequests` - Doula match form submissions

### External Services

**GitHub Integration (readProfile):**
- Uses GitHub App authentication via Octokit
- Fetches Hugo markdown files from `hugo/content/doulas/{slug}/index.md`
- Fetches profile images from `hugo/content/doulas/{slug}/{slug}.avif`
- Requires secrets: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID`

**Mailgun Email (email triggers):**
- Sends emails via Mailgun API
- Requires secret: `MAILGUN_API_KEY`
- Domain configured in `src/constants/email-domain.ts`

### Test Utilities

Test utilities are in `src/test-utils/`:
- `test-setup.ts` - Initializes firebase-functions-test and Firebase emulators
- `firestore-helpers.ts` - Helper functions for Firestore operations in tests
- `mock-request.ts` / `mock-response.ts` - Mock request/response objects
- `shared-assertions.ts` - Common test assertions

Tests use a setup function pattern that returns test dependencies and follows Arrange-Act-Assert structure with explicit cleanup in `afterAll` hooks.

## Important Patterns

### Membership Expiration Logic
The `claimProfile` function calculates membership expiration (`membershipExpiresAt`) based on the subscription start date. Expiration is set to the last day of the subscription month in the current or next year, depending on whether the renewal month has passed.

### Authentication Flow
1. User signs up via Firebase Auth
2. `createMemberOnUserCreated` trigger creates basic member document with `membershipActive: false`
3. User calls `claimProfile` to claim pre-imported profile (if exists)
4. `claimProfile` sets `membershipActive: true`, calculates expiration, and merges profile data into member document

### Secret Management
Functions requiring secrets declare them in the function configuration:
- Use `secrets: ["SECRET_NAME"]` in function config
- Access via `process.env.SECRET_NAME`
- Profile-related secrets are grouped in `PROFILE_SECRETS` constant

### Type Safety
- Strict TypeScript configuration with `strict: true`
- Member documents use `MemberDocument` type from `src/types/member-document.ts`
- Form data has typed interfaces in respective feature directories (e.g., `src/doula-match-form/types.ts`)
