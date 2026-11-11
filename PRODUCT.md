# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Families come first: when audiences compete for attention on the public site, the Family wins (confirmed 2026-11-11). The other three are not ranked against each other.

- **Family** — a person or household in the Rochester, NY Service Area seeking birth or postpartum doula support. Job: understand what a doula does and get in contact with one. Uses the Hugo Static Site only.
- **Prospective Member Doula** — a doula deciding whether to join. Job: understand membership benefits and enroll. Uses the Membership Join Page.
- **Member** — an enrolled doula. Job: manage membership, and create or edit their Doula Profile once they have Profile Approval. Uses the Members App.
- **Admin** — a person with the admin claim running the cooperative. Job: manage Members, Doula Profiles, Legacy Memberships, and work through Pending Intake Items (Match Requests, Contact Messages). Uses the Admin App.

## Product Purpose

Connect Families in the Rochester area with professional birth and postpartum doulas, and give those doulas a professional community (peer support, mentorship, continuing education, networking).

The software exists to:

- let a Family find a doula through Doula Discovery: Doula Search, Directory Browse, or a Match Request;
- explain doula care through Doula Education content;
- let doulas enroll, pay for, and manage their own membership, and maintain their Doula Profile once an Admin has granted Profile Approval;
- let Admins run the cooperative: membership, profiles, intake, analytics.

Success on the public site: a Family reaches a doula, either by contacting one directly from a Doula Profile or by submitting a Match Request.

## Positioning

Two claims, both confirmed 2026-11-11:

- **Local and doula-run.** A cooperative of Rochester-area doulas, founded in 2000, governed by a volunteer board of its own members. Families contact the doula or practice directly from the Doula Profile.
- **A human Match Request.** A Family describes its needs once. The cooperative broadcasts the request to Member Doulas, and each doula decides whether to reach out. No algorithm, no assignment.

Phrasing limits:

- Do not call the cooperative "not an agency" in a way that excludes agencies: membership includes independent doulas and doulas working in teams and agencies.
- A Match Request is never a booking, a referral, a confirmed match, or an instant or algorithmic match.
- No claim about fees, commissions, or "takes no cut" has been established. Do not make one.

## Operating Context

- **Three surfaces, one backend.** Hugo Static Site (doulacooperative.com), Members App, Admin App (admin.doulacooperative.com), all backed by Firebase Functions, Firestore, and Auth.
- **Doula Discovery.** Three paths: Doula Search (Pagefind index), Directory Browse (by Professional Service), Match Request (form).
- **Request Broadcast.** Currently happens in the cooperative's private Facebook group. Moving it into the Members App is possible but undecided.
- **Enrollment.** Open to the public. Any visitor can enroll from the Membership Join Page through Stripe subscription checkout (ADR-0004, supersedes invite-only ADR-0003).
- **Profile publishing.** Doula Profiles live in Firestore and are synced into Hugo content at build time (`scripts/sync-profiles-to-hugo.ts`). A Published Doula Profile requires Active Membership; Active Membership and Profile Approval are separate states.
- **Intake.** Match Requests and Contact Messages arrive as Pending Intake Items for Admins. A message about doula support belongs in a Match Request, not a General Inquiry.
- **Languages.** English and Spanish.

## Capabilities and Constraints

- Terminology is binding. Use the glossaries: `hugo/CONTEXT.md`, `members/CONTEXT.md`, `admin/CONTEXT.md`, `functions/CONTEXT.md`. Notably: Family (not user or client), Member Doula, Professional Service (not tag or specialty), Cost Offset (not insurance), Cancel Membership vs Membership Refund.
- Spam protection on public forms is reactive and per-form (ADR-0001).
- Legacy Membership migration is admin-only (ADR-0002).
- Analytics Dashboard metrics each have their own endpoint and server-enforced Metric Visibility (ADR-0005). Web Analytics come from Pirsch, never Firestore.
- Newsletter is paused. Newsletter Subscription state still exists on the Member; do not present it as an active program.
- Spanish coverage is partial: top-level pages and the find-a-doula pages are translated; the FAQ entries are English only.

Open decisions:

- **Canonical name.** See Brand Commitments.
- **Request Broadcast channel.** Facebook group today; Members App undecided.
- **Spanish parity.** Whether Spanish must match English page for page is not decided.

## Brand Commitments

- **Name, as observed, not yet reconciled:** site title and meta description say "Rochester Doula Cooperative"; page copy says "The Doula Cooperative"; the header wordmark says "Doula Cooperative". Canonical form is an open decision. Do not introduce a fourth variant.
- **Logo:** the header uses a text wordmark. A circular 'The Doula Cooperative' mark does exist as the default profile image served from ImageKit (`default-profile.png`); no logo file is in the repo.
- **Observed in current copy, not confirmed as binding:** the about page states a welcoming community for all doulas, a shared code of ethics, and advocacy for the rights of birthing people; the site refers to "birthing people" and "families".

- **Familiar over novel (confirmed 2026-11-11).** The public site follows Jakob's Law: it works the way sites Families already use work. Conventional navigation, search, provider cards, and forms. No concept-driven or metaphor-driven visual worlds.

## Evidence on Hand

Real, usable:

- Mission, history (founded 2000), and board description: `hugo/content/about-the-doula-cooperative.md`.
- Board roster with roles, in that file's front matter.
- Membership benefits: `hugo/content/join-the-doula-cooperative.md`.
- Doula Education: eleven FAQ entries in `hugo/content/faq/`, including Rochester fee averages in `doula-cost.md`.
- Spanish translations: `*.es.md` in `hugo/content/` and `hugo/content/find-a-doula/`, strings in `hugo/i18n/es.toml`.
- Board photos: two members have an `image_path` in the about page front matter; the other five reference their Doula Profile by slug.

Absent. Do not fabricate:

- **Testimonials or reviews.** None found in `hugo/content` or `hugo/layouts`.
- **Doula Profiles in the repo.** `hugo/content/doulas/` holds no profiles; they are synced from Firestore at build. Never invent doulas, bios, credentials, or photos for mockups presented as real.
- **Outcome statistics.** No counts of families served or matches made found in `hugo/content`.
- **Press, awards, partner or hospital endorsements.** None found in `hugo/content`.
- **Membership price.** Not present in site content or `hugo/i18n/en.toml`.

## Product Principles

1. **Families first.** On the public site, the path from arrival to contacting a doula outranks everything else, including recruitment.
2. **Doulas decide.** The product introduces; it never assigns or promises a match. The doula chooses to respond and the Family chooses the doula.
3. **Say only what is true.** No invented proof, no implied guarantees, no claim the cooperative has not made.
4. **One vocabulary.** The same concept carries the same name in copy, UI, and code-facing docs.

## Accessibility & Inclusion

- **WCAG 2.2 AA**, binding on all three surfaces: Hugo Static Site, Members App, Admin App (confirmed 2026-11-11).
- The public site is published in English and Spanish; parity is an open decision (see Capabilities and Constraints).
