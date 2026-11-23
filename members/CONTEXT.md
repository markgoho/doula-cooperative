# Members App

Angular app for member self-service.

## Language

**Member**:
Authenticated cooperative account with subscription, admin, and newsletter state.
_Avoid_: Profile, user account

**Doula Profile**:
Public directory content describing a doula's services and contact details.
_Avoid_: Member profile when referring to the member account

**Legacy Membership**:
Imported old-system membership record awaiting admin review or linking.
_Avoid_: Unclaimed profile

**Unclaimed Legacy Membership**:
A **Legacy Membership** not yet linked to a **Member**.
_Avoid_: Unclaimed profile, unlinked profile

**Unlinked Doula Profile**:
Existing **Doula Profile** content with no owning **Member**.
_Avoid_: Unclaimed profile

**Active Membership**:
A **Member** currently in good standing.
_Avoid_: Profile approval, approved member

**Profile Approval**:
Admin permission for a **Member** to create or edit a **Doula Profile**.
_Avoid_: Active membership, approved member

**Draft Profile**:
A **Doula Profile** hidden from public directory pages while retained for admin or owner use.
_Avoid_: Unclaimed profile, deleted profile, inactive profile

**Contact Message**:
General inbound message from the public contact form.
_Avoid_: Match request, lead

**Match Request**:
Public request for help finding a doula.
_Avoid_: Contact message, lead

**Referral**:
A **Match Request** as seen by **Members** in the member portal.
_Avoid_: Lead, claim

**Outreach**:
A **Member**'s first message to a **Referral**'s requester, sent through the cooperative so the contact is recorded.
_Avoid_: Response, claim, contact

**Referral Outcome**:
One **Member**'s own result for a **Referral**: hired, not hired, or not a fit. Never exclusive to one **Member**.
_Avoid_: Claim, taken, status

**Referral Notification**:
An email telling a **Member** that a new **Referral** is waiting in the member portal. Carries no requester contact or health details beyond due month, services, and general area.
_Avoid_: Lead alert, referral blast

**Referral Coordinator**:
A **Member** who relays **Referrals** to the cooperative's Facebook group, sees every **Referral** with who sent **Outreach** and their **Referral Outcomes**, and records **Offline Responses**. Not an **Admin**; granted and revoked by an **Admin**, independent of **Active Membership**.
_Avoid_: Coordinator admin, referral admin

**Offline Response**:
A **Referral Coordinator**'s record that a doula (a **Member** or an **Unclaimed Legacy Membership**) responded to a **Referral** outside the member portal. Records that they responded, not whether they were hired.
_Avoid_: Connected, claim, manual outreach

**No-Outreach Alert**:
An email telling **Admins** that a **Referral** has gone unanswered: no **Member** has sent **Outreach** on it and no **Offline Response** has been recorded since its **Referral Notification**. Sent once per **Referral**.
_Avoid_: No-response alert, stale lead alert

**Pending Intake Item**:
A **Contact Message** or **Match Request** not yet handled by an admin.
_Avoid_: Unsent item

**Processed Intake Item**:
A **Contact Message** or **Match Request** marked handled by an admin.
_Avoid_: Sent item

**Cancel Membership**:
Stop or deactivate a **Member**'s **Active Membership** without implying money is returned.
_Avoid_: Refund

**Membership Refund**:
Payment reversal workflow that deactivates membership and cascades to profile/newsletter cleanup.
_Avoid_: Cancel membership

**Newsletter Subscription**:
A secondary **Member** preference stored in account state and historically synced to a mailing list.
_Avoid_: Active newsletter program

**Admin**:
A signed-in person with the admin claim who can operate cooperative management screens.
_Avoid_: Webmaster, superuser

**Analytics Dashboard**:
An admin screen presenting cooperative metrics drawn from both Firestore data and **Web Analytics**.
_Avoid_: Reports, stats page

**Metric**:
A single answerable question on the **Analytics Dashboard** (e.g. new signups per day) with its own data source and visibility level.
_Avoid_: Widget, chart

**Metric Visibility**:
Whether a **Metric** is restricted to an **Admin** or may be exposed to an **Active Membership**; enforced server-side per metric.
_Avoid_: Public/private flag

**Web Analytics**:
Visitor behavior data (page views, top pages) sourced from the third-party Pirsch service, never from Firestore.
_Avoid_: Traffic stats, Pirsch data

## Relationships

- A **Match Request** is shown to **Members** as a **Referral**.
- A **Referral** may receive **Outreach** from many **Members**; each **Member** sends at most one **Outreach** per **Referral**.
- Sending **Outreach** reveals the requester's contact details to that **Member**.
- A **Member** may record one **Referral Outcome** per **Referral**; a hired **Referral Outcome** does not close the **Referral** to other **Members**.
- A **Member** may record a **Referral Outcome** only after sending **Outreach** on that **Referral**, or after a **Referral Coordinator** records an **Offline Response** for them, and may change it later. An **Offline Response** does not reveal the requester's contact details.
- Each new **Match Request** sends one **Referral Notification** to every **Member** with an active membership who has not turned them off.
- A **Referral Coordinator** may record **Offline Responses** on any **Referral**, naming a **Member** or an **Unclaimed Legacy Membership**, at most one per doula per **Referral**.
- A **Referral** with no **Outreach** and no **Offline Response** for too long triggers one **No-Outreach Alert**; an unrecorded hire made outside the portal does not prevent it.
- A **Member** may have zero or one **Doula Profile**.
- An **Admin** may manage **Members**, **Doula Profiles**, **Contact Messages**, **Match Requests**, and **Legacy Memberships**.
- A **Doula Profile** belongs to zero or one **Member** until linked.
- A **Legacy Membership** may reference zero or one **Unlinked Doula Profile** by slug.
- Linking an **Unlinked Doula Profile** to a **Member** may resolve the matching **Unclaimed Legacy Membership**.
- **Active Membership** and **Profile Approval** are separate states.
- Deleting an **Unclaimed Legacy Membership** may turn its referenced **Doula Profile** into a **Draft Profile** without deleting profile content.
- A **Contact Message** or **Match Request** starts as a **Pending Intake Item** and can become a **Processed Intake Item**.

## Example dialogue

> **Dev:** "Can a **Member** renew without changing their **Doula Profile**?"
> **Domain expert:** "Yes — membership status and public profile content are separate."
> **Dev:** "Is this legacy row an **Unlinked Doula Profile**?"
> **Domain expert:** "No — the row is an **Unclaimed Legacy Membership**. Its slug may point to an **Unlinked Doula Profile**."

## Flagged ambiguities

- "profile" must not mean both **Member** account state and **Doula Profile** content.
- "unclaimed profile" mixed imported membership records with unowned profile content; resolved: use **Unclaimed Legacy Membership** for import records and **Unlinked Doula Profile** for profile content without an owner.
- "insurance" (the `insurance` code field on a **Match Request**) is not insurance — it holds Medicaid/Carrot cost-offset selections; resolved: use **Cost Offset** (per the Hugo glossary) in all analytics labels and metric definitions.
