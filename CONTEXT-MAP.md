# Context Map

## Contexts

- [Functions APIs](./functions/CONTEXT.md) — owns server-side workflows, Firestore writes, auth-derived access control, public form intake, admin APIs, profile APIs, and external integrations.
- [Members App](./members/CONTEXT.md) — Angular app for member self-service.
- [Admin App](./admin/CONTEXT.md) — Angular app for cooperative administration (members, unclaimed profiles, match requests, messages, analytics).
- [Hugo Static Site](./hugo/CONTEXT.md) — public website, doula directory, and static content.

## Relationships

- **Members App → Functions APIs**: Members App calls Functions APIs for authenticated member self-service operations.
- **Admin App → Functions APIs**: Admin App calls Functions APIs for authenticated administrative operations.
- **Hugo Static Site → Functions APIs**: Hugo Static Site submits public forms to Functions APIs.
- **Functions APIs → Hugo Static Site**: Functions APIs trigger profile publishing workflows that affect static site content.
