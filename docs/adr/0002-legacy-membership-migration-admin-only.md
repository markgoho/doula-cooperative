# ADR-0002: Legacy membership migration is admin-only

## Status

Accepted — 2026-05-10

## Context

Legacy memberships are few enough and migrate slowly enough that self-service or automatic linking adds more product and implementation complexity than it removes. The cooperative has roughly 65 members, and legacy migration is occasional admin work rather than a high-volume user journey.

## Decision

Legacy membership migration happens through admin-only **Link Legacy Membership** workflows. Members should not claim legacy memberships themselves, and the system should not automatically link legacy data to new memberships.

## Consequences

- Remove self-service claim behavior from active product/API surface.
- Prefer simple admin tools over automated matching or member-facing claim flows.
- Future migration work should optimize admin review and linking, not member self-service.
