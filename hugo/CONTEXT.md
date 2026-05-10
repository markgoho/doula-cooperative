# Hugo Static Site

Hugo Static Site is the public website for the cooperative. It presents static educational content, public doula discovery, and public form entry points.

## Language

**Family**:
A person or household seeking doula support through the public website.
_Avoid_: User, client

**Member Doula**:
A doula with active cooperative membership who may receive shared Match Requests and decide whether to contact a Family.
_Avoid_: Member

**Doula Profile**:
A page for one doula in the directory, containing bio, credentials, professional services, and contact information.
_Avoid_: Member profile

**Published Doula Profile**:
A Doula Profile visible on the public site.
_Avoid_: Active profile

**Professional Service**:
A service area or support focus offered by a doula and shown on Doula Profiles.
_Avoid_: Tag, specialty

**Credential**:
A professional designation or training displayed on a Doula Profile.
_Avoid_: Professional Service

**Practice Name**:
A doula’s public business or practice name displayed with profile contact information.
_Avoid_: Business name, agency

**Doula Discovery**:
The public website paths a visitor can use to find a doula.
_Avoid_: Find a Doula flow

**Doula Search**:
A discovery path where a visitor searches indexed profile and site content.
_Avoid_: Profile lookup

**Directory Browse**:
A discovery path where a visitor browses doulas grouped by Professional Service.
_Avoid_: Member browse

**Match Request**:
A public form submission where a Family shares needs and preferences so the cooperative can share the request with member doulas.
_Avoid_: Booking, referral, confirmed match, instant match, algorithmic match

**Request Broadcast**:
The cooperative shares a Match Request with Member Doulas through the private Facebook group for optional follow-up.
_Avoid_: Assignment, dispatch

**Support Need**:
A Family-selected kind of help in a Match Request used for intake routing.
_Avoid_: Professional Service

**Birth Location**:
The planned place of birth supplied in a Match Request when birth doula support is requested.
_Avoid_: Hospital

**Cost Offset**:
An optional way a Family expects to reduce out-of-pocket doula cost.
_Avoid_: Insurance

**Due Date**:
The baby’s estimated date of arrival or birthdate used to understand timing and baby age for requested support.
_Avoid_: Baby date

**Service Area**:
The Rochester, NY region where cooperative doulas support families.
_Avoid_: Location

**General Inquiry**:
A non-match message sent to the cooperative through the public contact form.
_Avoid_: Contact request

**Doula Education**:
Public content that explains doula roles, support types, costs, and care relationships.
_Avoid_: FAQ

**Membership Join Page**:
The public marketing and invite-only payment entry point for doulas interested in cooperative membership.
_Avoid_: Membership management

**Invite-Only Enrollment**:
A membership enrollment state where the join page is public but checkout is shown only with an invite access key.
_Avoid_: Paused membership, closed membership

## Relationships

- A **Family** uses **Doula Discovery** to find doula support
- A **Match Request** includes one or more **Support Needs**
- A **Match Request** may include a **Due Date**
- A **Match Request** may include a **Birth Location** when birth doula support is requested
- A **Match Request** may include **Cost Offsets**
- A **Match Request** uses ZIP Code to understand the Family’s **Service Area**
- A **Match Request** is shared with **Member Doulas** through a **Request Broadcast**
- A **Member Doula** may have zero or one **Published Doula Profile**
- A **Published Doula Profile** requires active cooperative membership
- A **Doula Profile** belongs to exactly one **Member Doula**
- A **Doula Profile** lists zero or more **Professional Services**
- A **Support Need** may map to one or more **Professional Services**, but not every **Professional Service** is a **Support Need**
- A **Doula Profile** may display **Credentials**
- A **Doula Profile** may display a **Practice Name**
- **Doula Profile** contact information connects a **Family** directly with the doula or practice
- **Doula Discovery** includes **Doula Search**, **Directory Browse**, and **Match Requests**
- A doula-support message should become a **Match Request**, not a **General Inquiry**
- The **Membership Join Page** currently uses **Invite-Only Enrollment**

## Example dialogue

> **Dev:** "If a Family selects postpartum doula support, do we immediately assign them a Member Doula?"
> **Domain expert:** "No. That creates a Match Request. The cooperative broadcasts it to Member Doulas, and each doula decides whether to contact the Family."

## Flagged ambiguities

- "tag" appears in Hugo templates and front matter for **Professional Service**; resolved: tag is the implementation term, Professional Service is the domain term.
- Footer copy says "Browse Members" for professional service links; resolved: these links browse doulas by **Professional Service**, not cooperative members.
- **Request Broadcasts** currently happen in the private Facebook group; future Members App support is possible but not decided.
