# Functions APIs

Firebase Functions backend owning server-side workflows, Firestore writes, auth-derived access control, public form intake, admin APIs, profile APIs, and external integrations.

## Language

**Functions APIs**:
Firebase Functions backend owning server-side workflows, Firestore writes, auth-derived access control, public form intake, admin APIs, profile APIs, and external integrations.
_Avoid_: Members app APIs

**Member**:
A cooperative account record that may carry membership standing, billing state, and profile ownership.
_Avoid_: User, doula

**Membership**:
A cooperative standing/access relationship, either Stripe-backed or legacy.
_Avoid_: Subscription

**Active Membership**:
A **Member** currently in good standing.
_Avoid_: Paid subscription

**Stripe Subscription**:
The Stripe billing mechanism backing paid **Membership**.
_Avoid_: Membership

**Checkout Completion**:
A Stripe event that creates or updates **Member** membership state after successful checkout.
_Avoid_: Payment success

**New Member Signup**:
A new Stripe-backed **Membership** starting, identified by a **Member**'s `subscriptionStart`; the canonical growth event since public enrollment opened (ADR-0004). Excludes legacy-linked memberships.
_Avoid_: Account created, invite

**Subscription Update**:
A Stripe event that changes billing state while preserving **Membership** rules.
_Avoid_: Membership update

**Membership Refund**:
A refund workflow that deactivates the **Member**, drafts the **Profile**, unsubscribes newsletter, and sends notifications.
_Avoid_: Cancel membership

**Processed Stripe Event**:
An idempotency record preventing duplicate webhook side effects.
_Avoid_: Webhook log

**Newsletter Subscription**:
A paused **Member** mailing-list preference mirrored in Firestore and historically synced to MailerLite.
_Avoid_: Active newsletter program

**External Sync**:
A write to a third-party system after local state changes.
_Avoid_: Local update

**Admin Failure Notification**:
An email alert when **External Sync** or cascade action fails.
_Avoid_: Log-only failure

**Authenticated Member**:
A signed-in Firebase user acting on their own **Member** record.
_Avoid_: User

**Admin**:
A signed-in user with the admin custom claim who can manage **Members**, **Profiles**, **Match Requests**, **Contact Messages**, and **Legacy Memberships**.
_Avoid_: Webmaster, superuser

**Profile Owner**:
The **Member** whose UID owns a **Profile**.
_Avoid_: User, author

**Owner-or-Admin Access**:
An authorization rule allowing the **Profile Owner** or an **Admin**.
_Avoid_: User access

**Profile**:
A public doula directory listing.
_Avoid_: Member record, doula account

**Legacy Membership**:
A pre-current-system cooperative membership record imported from the old system, carrying member identity, profile slug, and subscription/payment dates until admin links it to a **Member**.
_Avoid_: Legacy user, migrated user, import record, unclaimed profile

**Unclaimed Legacy Membership**:
A **Legacy Membership** not yet linked to a **Member**.
_Avoid_: Unclaimed profile, unlinked profile

**Unlinked Profile**:
Existing **Profile** content with no **Profile Owner**.
_Avoid_: Unclaimed profile

**Link Legacy Membership**:
An admin action that connects a **Legacy Membership** to a new **Member** and may link an **Unlinked Profile**.
_Avoid_: Claim, migrate user

**Draft Profile**:
A **Profile** hidden from public view and visible only to its owner or an admin.
_Avoid_: Unclaimed profile, unpublished member

**Profile Approval**:
An admin grant allowing a **Member** to create or edit a public **Profile**.
_Avoid_: Approve profile

**Profile Publishing**:
The workflow that turns approved **Profile** changes into Hugo static site content and deploy activity.
_Avoid_: Deploy profile

**Profile Webhook**:
The backend endpoint receiving profile publishing callbacks from the GitHub/static-site workflow.
_Avoid_: Profile API

**Contact Message**:
A general inbound message from the public contact form.
_Avoid_: Match request, lead

**Match Request**:
A public request for help finding a doula.
_Avoid_: Contact message, lead

**Referral**:
A **Match Request** as seen by **Members** in the member portal.
_Avoid_: Lead, claim

**Outreach**:
A **Member**'s first message to a **Referral**'s requester, sent through the cooperative so the contact is recorded.
_Avoid_: Response, claim, contact

**Referral Outcome**:
One doula's result for a **Referral**: hired, not hired, or not a fit. Recorded by the doula (a **Member**), or by a **Referral Coordinator** for an **Unclaimed Legacy Membership**, which has no portal account. Never exclusive to one doula.
_Avoid_: Claim, taken, status

**Referral Notification**:
An email telling a **Member** that a new **Referral** is waiting in the member portal. Carries no requester contact or health details beyond due month, services, and general area.
_Avoid_: Lead alert, referral blast

**Referral Coordinator**:
A **Member** who relays **Referrals** to the cooperative's Facebook group, sees every **Referral** with who sent **Outreach** and their **Referral Outcomes**, and records **Offline Responses**. Not an **Admin**; granted and revoked by an **Admin**, independent of **Active Membership**.
_Avoid_: Coordinator admin, referral admin

**Offline Response**:
A **Referral Coordinator**'s record that a doula (a **Member** or an **Unclaimed Legacy Membership**) responded to a **Referral** outside the member portal. By itself it records that they responded, not whether they were hired.
_Avoid_: Connected, claim, manual outreach

**No-Outreach Alert**:
An email telling **Admins** that a **Referral** has gone unanswered: no **Member** has sent **Outreach** on it and no **Offline Response** has been recorded since its **Referral Notification**. Sent once per **Referral**.
_Avoid_: No-response alert, stale lead alert

**Match Request Notification**:
An email telling **Admins** that a new **Match Request** has arrived. Carries the same limited details as a **Referral Notification** plus a link to the **Match Request** in the admin app; never the requester's name, contact, or health details.
_Avoid_: Doula match email, admin match email

**Public Form Intake**:
The backend flow that validates, spam-checks, stores, and emails public form submissions.
_Avoid_: Lead capture

**Spam Policy**:
A per-form set of spam checks applied reactively based on observed spam.
_Avoid_: Global spam rules

**Pending Intake Item**:
A **Contact Message** or **Match Request** not yet handled by an **Admin**.
_Avoid_: Unsent item

**Processed Intake Item**:
A **Contact Message** or **Match Request** marked handled by an **Admin**.
_Avoid_: Sent item

## Relationships

- A **Match Request** is shown to **Members** as a **Referral**.
- A **Referral** may receive **Outreach** from many **Members**; each **Member** sends at most one **Outreach** per **Referral**.
- Sending **Outreach** reveals the requester's contact details to that **Member**.
- A **Member** may record one **Referral Outcome** per **Referral**; a hired **Referral Outcome** does not close the **Referral** to other **Members**.
- A **Member** may record a **Referral Outcome** only after sending **Outreach** on that **Referral**, or after a **Referral Coordinator** records an **Offline Response** for them, and may change it later. An **Offline Response** does not reveal the requester's contact details.
- Each new **Match Request** sends one **Referral Notification** to every **Member** with an active membership who has not turned them off.
- A **Referral Coordinator** may record **Offline Responses** on any **Referral**, naming a **Member** or an **Unclaimed Legacy Membership**, at most one per doula per **Referral**.
- A **Referral Coordinator** may record, change or clear the **Referral Outcome** of an **Unclaimed Legacy Membership** that has an **Offline Response** on that **Referral**; never a **Member**'s. A hired one counts toward "A member was hired" like a **Member**'s.
- Linking an **Unclaimed Legacy Membership** to a **Member** moves its **Offline Responses** and **Referral Outcomes** to that **Member**, but never replaces a **Referral Outcome** the **Member** already recorded.
- Changing an **Unclaimed Legacy Membership**'s email keeps its **Offline Responses** and **Referral Outcomes** with it.
- Deleting an **Unclaimed Legacy Membership** keeps its **Offline Responses** and **Referral Outcomes** as history; they still count toward "A member was hired".
- A **Referral** with no **Outreach** and no **Offline Response** for too long triggers one **No-Outreach Alert**; an unrecorded hire made outside the portal does not prevent it.
- A **Member** may have zero or one **Profile**.
- A **Profile** may be linked to zero or one **Member**.
- A **Profile Owner** is the **Member** linked by `ownerUid`.
- **Owner-or-Admin Access** protects self-service profile and member operations.
- A **Membership** may be backed by a **Stripe Subscription** or by legacy dates.
- An **Active Membership** may have a **Stripe Subscription** in a grace-period state such as `past_due`.
- A **Checkout Completion** can create a new **Member** or update an existing **Member**.
- A **Subscription Update** can change **Membership** standing without changing profile ownership.
- A **Membership Refund** deactivates **Membership** and cascades to related profile/newsletter actions.
- A **Processed Stripe Event** belongs to exactly one Stripe webhook event ID.
- **Newsletter Subscription** is system-aware but paused as an active product surface.
- **External Sync** failures should produce visible **Admin Failure Notifications** when local state already changed.
- An **Unclaimed Legacy Membership** may reference zero or one **Unlinked Profile** by slug.
- Linking an **Unlinked Profile** to a **Member** may resolve the matching **Unclaimed Legacy Membership**.
- A **Draft Profile** is a visibility state of a **Profile**, not an ownership state.
- **Profile Approval** allows a **Member** to create or edit a **Profile**.
- **Profile Publishing** propagates approved **Profile** changes to **Hugo Static Site** content.
- **Profile Webhook** receives callbacks from the profile publishing workflow.
- **Public Form Intake** produces **Contact Messages** and **Match Requests**.
- Each public form has its own **Spam Policy**.
- A **Contact Message** or **Match Request** starts as a **Pending Intake Item** and can become a **Processed Intake Item**.
- **Members App** calls **Functions APIs** for authenticated member and admin operations.
- **Hugo Static Site** submits public forms to **Functions APIs**.
- **Functions APIs** trigger profile publishing workflows that affect **Hugo Static Site** content.

## Example dialogue

> **Dev:** "Can we let **Members** claim **Legacy Memberships** if their email matches?"
> **Domain expert:** "No. Use **Link Legacy Membership**. Migration is admin-only because member count is small and migrations are slow."
> **Dev:** "After linking, does that create an **Active Membership**?"
> **Domain expert:** "Only if the linked legacy dates put the **Membership** in good standing; don't confuse that with a **Stripe Subscription**."

## Flagged ambiguities

- "members app APIs" was too narrow for this backend context; resolved: use **Functions APIs** for the whole Firebase Functions backend.
- "unclaimed profile" mixed imported membership records with unowned profile content; resolved: use **Unclaimed Legacy Membership** for import records and **Unlinked Profile** for profile content without an owner.
- Self-service legacy membership claim is rejected for this project; legacy migration should happen through admin-only **Link Legacy Membership**.
