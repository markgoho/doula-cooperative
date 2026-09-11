# Admin App

Angular app for cooperative administration (members, unclaimed profiles, match requests, messages, analytics). Served at `admin.doulacooperative.com`.

## Language

**Admin**:
A signed-in person with the admin claim who can operate cooperative management screens.
_Avoid_: Webmaster, superuser

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

- An **Admin** manages **Members**, **Doula Profiles**, **Contact Messages**, **Match Requests**, and **Legacy Memberships**.
- A **Doula Profile** belongs to zero or one **Member** until linked.
- A **Legacy Membership** may reference zero or one **Unlinked Doula Profile** by slug.
- Linking an **Unlinked Doula Profile** to a **Member** resolves the matching **Unclaimed Legacy Membership**.
- **Active Membership** and **Profile Approval** are separate states.
- Deleting an **Unclaimed Legacy Membership** may turn its referenced **Doula Profile** into a **Draft Profile** without deleting profile content.
- A **Contact Message** or **Match Request** starts as a **Pending Intake Item** and can become a **Processed Intake Item**.
