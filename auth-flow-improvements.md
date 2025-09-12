# Auth Flow Improvements

This document outlines planned improvements for the authentication and user signup flows. Each item represents a task to be completed.

## Flow 1: Brand New User Signup

- [x] **Reduce User Friction After Signup**: Allow users to log in immediately after signing up into a limited, "unverified" state. The application should prompt them to verify their email to unlock full functionality.
- [ ] **Rethink `emailVerified` Flag in Firestore**: Remove the `emailVerified` field from Firestore `members` documents. Rely on the Firebase Auth user token (`user.emailVerified`) as the single source of truth for email verification status. This will involve updating Firestore security rules to check the auth token's `email_verified` claim.

## Flow 2: Existing Doula Coop Subscriber Signup

- [ ] **Automate Profile Claim Process**: The profile claim should be an automatic, seamless process. After email verification, the backend should immediately check for a migrated profile and merge the data without requiring a separate user action.
- [ ] **Improve Data Integrity with a Transaction**: Refactor the profile claim logic to use a single Firestore transaction for reading the migrated profile, merging the data into the `members` collection, and deleting the migrated profile record. This ensures the operations are atomic and data remains consistent.
