# Analytics: dedicated endpoints with per-metric visibility

Every Analytics Dashboard metric is served by a dedicated `analytics-api` Elysia route under `/api/analytics/**`, with aggregation done server-side and each route declaring its own auth guard (`adminGuard` now; `userGuard` when a metric is promoted to members). We deliberately do **not** reuse the existing admin list endpoints (`/api/admin/members`, match-requests) or compute metrics client-side, even though the dashboard already loads that data.

We chose this because membership analytics may later be exposed to members (see grilling decision "A"): the existing list endpoints are admin-guarded, so client-side computation off them would have to be rebuilt server-side to ever go member-visible. Dedicated endpoints make promotion a one-line guard swap, keep aggregation unit-testable at the API boundary, and keep server-only concerns (the Pirsch API secret and the bundled ZIP-centroid dataset) off the client.
