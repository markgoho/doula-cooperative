# AGENTS.md

Monorepo with Hugo static site, Firebase Functions, and Angular members portal. Tech stack: Firebase, Hugo, Angular, TypeScript, SCSS, Bun.

## Build/Lint/Test Commands

- **Single test:** `cd functions && bun test test/claim-profile.test.ts`
- **All tests:** `cd functions && bun test`
- **Lint:** `cd functions && npm run lint`
- **Build:** `cd functions && npm run build`

## Firebase Functions Patterns

- **Structure:** Functions exported from `src/index.ts` with lazy imports for cold start optimization
- **Collections:** Use constants from `src/constants/collections.ts` (e.g., `MEMBERS_COLLECTION`)
- **Idempotent:** Keep functions idempotent unless involving timestamps
- **Secrets:** Declare in function config with `secrets: ["SECRET_NAME"]`, access via `process.env.SECRET_NAME`

## Key Collections

- `members` - Primary user collection (uid, email, membershipActive, stripeCustomerId, etc.)
- `messages` - Contact form submissions
- `matchRequests` - Doula match form submissions
- `migrated_users_import` - Temporary collection for pre-imported profiles
- `processed_stripe_events` - Webhook idempotency tracking

## External Services

- **Stripe:** Webhook handler for `checkout.session.completed`, creates users after payment
- **Mailgun:** Email triggers for contact forms and match requests
- **GitHub:** Octokit integration for reading Hugo content from `hugo/content/doulas/`

## Testing

- Uses Firebase emulators (Firestore: 127.0.0.1:8080, Auth: 127.0.0.1:9099)
- Test utilities in `src/test-utils/`: setup functions, mock request/response, firestore helpers
- Follow Arrange-Act-Assert with cleanup in `afterAll` hooks

## Type Safety

- Strict TypeScript with `strict: true`
- Member documents: `MemberDocument` type from `src/types/member-document.ts`
- Form data: Typed interfaces in feature directories (e.g., `src/doula-match-form/types.ts`)

## Cursor Rules

Follow `firebase-functions.mdc`: Collection constants, idempotent functions
