# Context

Lightweight domain language for architecture discussions in this repository. These terms name user-facing concepts and operational workflows; they are not implementation-layer names.

## Terms

### Member

A person with an account in the cooperative membership system. A Member may have an active or inactive Membership and may or may not have a linked public Profile.

### Membership

A Member's paid cooperative status, including subscription dates, active/inactive state, and Stripe-related payment identifiers when applicable.

### Profile

The public doula directory record shown on the Hugo site. A Profile can be published or draft, and may be linked to a Member account for self-service editing.

### Unclaimed Profile

A pre-existing Profile or imported membership record that is not yet fully associated with a signed-in Member account.

### Unlinked Profile

A public Profile that exists without an owner Member. Admins can link an Unlinked Profile to a Member when reconciling directory records.

### Clean Slate Delete

An admin-only cleanup workflow that removes a Member from all integrated systems used by the cooperative, including payment, newsletter, profile, image, Firestore, and authentication records.

### Public Form Intake

The shared submission workflow for public website forms: validate bot protection, apply the form's spam policy, send notification email, persist the submission, and return a user-facing response.

### Contact Form

The public form for general website contact. It currently has stricter spam policy than the Doula Match Form because it has received observed spam.

### Doula Match Form

The public form for visitors requesting help finding a doula. Its spam policy is intentionally lighter unless observed spam changes that risk.

### Stripe Membership Event

A Stripe webhook event that changes Membership state or triggers Membership-side effects, such as checkout completion, refund processing, subscription ending, or subscription status changes.
