# HIPAA and NY privacy law for Match Request / Referral handling

Research for #101 (map #100). Retrieved 2026-11-22. **Not legal advice.** Primary sources only; where a source could not be fetched directly it is noted. Confidence flags: **[firm]** = text of the rule says it; **[likely]** = reasoned application of the text to our facts; **[uncertain]** = open question, get counsel if it matters.

## Facts assumed

- The co-op runs a public doula directory and a public match form. A requester submits a **Match Request**: name, email, phone, ZIP, estimated due date, services wanted, birth location, free-text notes (may include health info), and **Cost Offset** selections (Medicaid / Carrot).
- The co-op relays each Match Request to member doulas as a **Referral** (members portal `/referrals`; admin email to Mark + co-op Gmail; FB posting by the referral coordinator). The public form says: "If you're looking for doula support, your information will be shared with cooperative members." (`hugo/i18n/en.toml`)
- The co-op itself does **not** furnish doula care, does **not** bill any payer, and is **not** enrolled with NY Medicaid as a doula group. Some members individually bill NY Medicaid.

If any of those last three facts changes, the HIPAA answer may change (see section 2).

## Bottom line

1. **HIPAA: the co-op is most likely neither a covered entity nor a business associate.** [likely] It doesn't furnish, bill, or get paid for health care, so it isn't a "health care provider", and it doesn't handle data _on behalf of_ a covered entity. Match Request data in the co-op's hands is very likely not "PHI".
2. **Medicaid-billing members don't change that for the co-op**, as long as the co-op is serving the requester rather than running intake _for_ a doula's practice. [likely] But those members are probably covered entities themselves, and once a Referral reaches one of them it is PHI _in her hands_. So a Referral landing in her personal Gmail (no BAA) becomes her HIPAA exposure, not the co-op's.
3. **NY SHIELD Act likely does bind the co-op now.** [likely] Since the 2024-25 amendments, "medical information" is a private-information element in GBL 899-aa. A requester's name plus due date or health notes is "private information". That brings in breach notification (899-aa) and a duty to keep "reasonable safeguards" (899-bb), including choosing vendors that can keep safeguards and requiring them by contract.
4. **Watch item: the NY Health Information Privacy Act (S9269/A10357)** passed both houses in June 2026. It has no nonprofit or small-entity exemption and would plainly reach Match Requests (reproductive-health data). The Governor vetoed the 2025 version (S929). As of retrieval, the nysenate.gov page shows no action by the Governor on S9269. [uncertain] **Re-check before finalizing the v2 spec.**
5. **"Keep PHI out of email, inside the platform" is not a HIPAA requirement for the co-op. It is a sensible privacy policy that also satisfies legal duties we likely do have.** SHIELD requires reasonable safeguards, minimal exposure, and disposal. It also protects Medicaid-billing members from their own HIPAA exposure, and positions us for NYHIPA if it is signed. Frame it publicly as co-op policy, not "HIPAA compliance". This matches the map's standing decision.

## 1. HIPAA definitions that decide it (45 CFR 160.103)

Source: eCFR 45 CFR 160.103, https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-160/subpart-A/section-160.103

- **Covered entity** means "(1) A health plan. (2) A health care clearinghouse. (3) A health care provider who transmits any health information in electronic form in connection with a transaction covered by this subchapter." [firm]
- **Health care provider** includes "any other person or organization who furnishes, bills, or is paid for health care in the normal course of business." [firm]
- **Individually identifiable health information** must, among other things, be "created or received by a health care provider, health plan, employer, or health care clearinghouse". **PHI** is individually identifiable health information (with exclusions). [firm] So health info held by an entity that is none of those (a referral directory) is not PHI _at that entity_.
- **Business associate** means, "with respect to a covered entity, a person who: (i) On behalf of such covered entity ... creates, receives, maintains, or transmits protected health information for a function or activity regulated by this subchapter ..." or provides listed services "to or for such covered entity" involving disclosure of PHI from it. [firm]
- **Exception**: BA does not include "A health care provider, with respect to disclosures by a covered entity to the health care provider concerning the treatment of the individual." [firm]
- **Transaction** means "the transmission of information between two parties to carry out financial or administrative activities related to health care", including "Health care claims or equivalent encounter information." [firm]

HHS: "If an entity does not meet the definition of a covered entity or business associate, it does not have to comply with the HIPAA Rules." See https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html (hhs.gov blocks automated fetches; read via a 2025 Wayback copy). CMS decision tool: https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/HIPAA-ACA/AreYouaCoveredEntity.html

### Applied to the co-op

- **Not a covered entity.** [likely] It is not a plan or clearinghouse. It doesn't furnish, bill, or get paid for doula care. Member dues are not payment for health care.
- **Not a business associate.** [likely] The requester gives data to the co-op directly. The co-op isn't hired by a covered doula to do intake, billing, scheduling, or practice management. HHS's health-app scenarios (Feb 2016) draw this line. A developer serving the consumer "at the consumer's request and on her behalf" is not a BA. A doctor's mere recommendation of an app doesn't create a BA relationship. A developer the provider _contracts with_ for "patient management services ... patient messaging" **is** a BA. https://www.hhs.gov/sites/default/files/ocr-health-app-developer-scenarios-2-2016.pdf (via Wayback)

## 2. What would flip the HIPAA answer

- **Co-op enrolls as a NY Medicaid doula-only group or bills for doulas.** The eMedNY Doula manual lets "a doula-only group ... enroll in the New York State Medicaid program as a doula services provider and bill Medicaid directly", with payment "to the group provider number". [firm] A billing group transmitting claims would be a covered entity. https://www.emedny.org/ProviderManuals/Doula/PDFS/Doula_Policy_Guidelines.pdf (March 2026 edition, §§ 4, 7, 13.1.2, 13.4)
- **Co-op performs a function for a covered member's practice**: client intake, client messaging, storing client records, or billing. That would make it that member's BA. [likely] It would then need BAAs with members and its own BAA'd subcontractors. **This is the v2 risk to watch** (next section).

### v2 Outreach and Referral Outcomes (#100, #104)

- **Outreach through the portal** (contact revealed after first contact) is still the co-op relaying the _requester's_ request to candidate doulas. Requester-directed, like v1. [likely] Not BA-creating by itself.
- **Referral Outcomes** ("Hired me / Did not hire me / Connected offline ...") are a different flow: a member reports back to the co-op that a named person became her client. For a Medicaid-billing member that report is arguably _her_ disclosure of PHI. HIPAA needs a permitted basis, and it isn't obviously treatment, payment, or her health care operations. [uncertain] Mitigations: keep Outcome data coarse, avoid health detail, consider telling requesters at intake that the co-op tracks whether a match happened, and don't build Outcomes into a client-management tool for members.
- If the portal grows into ongoing member-client messaging or record keeping that members use to run their practice, the BA analysis shifts toward "Yes". [likely]

## 3. Medicaid-billing members

- NY Medicaid enrollment requires an NPI and that the doula "Become familiar with the Health Insurance Portability and Accountability Act (HIPAA)". The doula must keep the practitioner recommendation "in their documentation records for the Medicaid member in compliance with HIPAA standards." (eMedNY Doula manual, provider requirements & recommendation sections.) [firm]
- NY Medicaid claims go through eMedNY / ePACES electronic submission (manual §1 links), and managed-care plans are billed from April 2025. A doula filing those claims electronically is a covered entity under 160.103(3). [likely; paper claiming is theoretically possible but unusual]
- The co-op relaying a Referral to such a doula **does not make the co-op her BA** (section 1). But once she receives the Referral it is PHI in her hands. Her vendors (personal Gmail, phone backups) would need BAAs under her own obligations. Consumer Gmail offers none (section 5). This is the strongest practical reason to keep Referral detail out of member email: it keeps PHI out of members' non-BAA inboxes.
- No NY doula-specific confidentiality statute was found. The DOH doula directory law (S1867A/A5435A) concerns publishing _doula_ info, not client data. [uncertain; enacted chapter text not reviewed] https://www.health.ny.gov/health_care/medicaid/program/doula/overview.htm

## 4. New York law

### SHIELD Act: GBL 899-aa (breach notification)

https://www.nysenate.gov/legislation/laws/GBS/899-AA (page revision history shows amendments 2024-12-27, 2025-02-21, 2025-03-28). Quotes below are from a fetch summary of the page. Verify wording against the page.

- Applies to "Any person or business which owns or licenses computerized data which includes private information". No nonprofit carve-out appears. [firm text; applicability to a nonprofit co-op: likely]
- **Private information** = personal information combined with an unencrypted listed element. The elements include "medical information, meaning any information regarding an individual's medical history, mental or physical condition, or medical treatment or diagnosis by a health care professional" and "health insurance information" (policy number, insurer identifier, application and claims history). [firm]
  - Name + due date / pregnancy / health notes → very likely "physical condition" → private information. [likely]
  - A bare "Medicaid" Cost Offset checkbox is probably not "health insurance information" (no policy number or ID) but signals coverage status. [uncertain]
- Breach notice to affected NY residents "within thirty days after the breach has been discovered". Notice also goes to the AG, Department of State and State Police. Email notice is allowed only if the person "has expressly consented". [firm]
- HIPAA-covered entities have coordination rules (no duplicate notice; AG within 5 business days of HHS notice). Not relevant if we aren't covered. [firm]

### SHIELD Act: GBL 899-bb (data security)

https://www.nysenate.gov/legislation/laws/GBS/899-BB

- Requires "reasonable safeguards to protect the security, confidentiality and integrity of the private information including, but not limited to, disposal of data." [firm]
- **Small business** (<50 employees, or <$3M revenue, or <$5M assets): safeguards "appropriate for the size and complexity of the small business". The co-op qualifies. [firm/likely]
- Example safeguards include "selects service providers capable of maintaining appropriate safeguards, and requires those safeguards by contract" and "disposes of private information within a reasonable amount of time after it is no longer needed for business purposes". [firm] This bears directly on Firestore retention beyond the 14-day portal window (open item on #100).
- HIPAA-compliant regulated entities are deemed compliant. Enforcement is by the AG under GBL 349. "Nothing in this section shall create a private right of action." [firm]

### NY Health Information Privacy Act (pending)

- **2025 S929/A2141**: passed both houses January 2025, delivered 2025-12-08, **vetoed 2025-12-19** (Veto Memo 135). https://www.nysenate.gov/legislation/bills/2025/S929 [firm]
- **2026 S9269/A10357**: passed Senate 2026-06-03 and Assembly 2026-06-04. No delivery to the Governor or signature shown at retrieval. https://www.nysenate.gov/legislation/bills/2025/S9269 [firm as of retrieval; status may change]
- If enacted as passed (summary of bill text):
  - Covers any entity controlling processing of "regulated health information", which includes reproductive or sexual health information.
  - No nonprofit or small-entity exemption. HIPAA PHI and covered entities are exempt.
  - Processing allowed only with authorization or when "strictly necessary" for listed purposes, such as providing the requested service. Relaying a Match Request to doulas is plausibly that.
  - Written contracts with service providers, with subprocessor flow-down.
  - Disposal within 60 days after the data is no longer needed.
  - Access and deletion rights within 30 days.
  - AG enforcement, up to $15,000 per violation.
  - Effective 6 months after becoming law per bill text; the sponsor memo says one year.
  - [uncertain] Effect on the co-op: a materially bigger compliance lift than SHIELD. Vendor DPAs and retention would matter most.

## 5. Vendors

**If HIPAA applied** (it likely doesn't to the co-op), every vendor that creates, receives, maintains or transmits PHI would need a BAA. 45 CFR 164.502(e), 164.308(b): https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-E/section-164.502

HHS cloud guidance: a cloud provider storing ePHI is a BA "even if the CSP processes or stores only encrypted ePHI and lacks an encryption key". The "conduit" exception "is limited to transmission-only services". Using a CSP without a BAA violates 164.308(b)(1) and 164.502(e). https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html (via Wayback) [firm]

| Vendor                                                            | BAA available?                                                                                                                                                    | Notes                                                                                                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Google Cloud: Firestore, Cloud Run functions, Identity Platform   | Yes, Google Cloud BAA; these are on Google's HIPAA covered-products list                                                                                          | https://cloud.google.com/security/compliance/hipaa. Google says not to store PHI in Identity Platform optional or custom attributes. |
| Firebase-branded products (Firebase Auth, Hosting, Firebase SDKs) | **Not confirmed.** "Firebase" isn't on the covered-products list; the Firebase privacy page doesn't mention HIPAA                                                 | https://firebase.google.com/support/privacy [uncertain]                                                                              |
| Mailgun (Sinch)                                                   | A HIPAA BAA addendum exists; plan eligibility not confirmed                                                                                                       | https://www.mailgun.com/legal/hipaa-baa/ [uncertain]                                                                                 |
| Gmail                                                             | Only Google Workspace under the Workspace BAA ("Customers who have not signed a BAA with Google must not use PHI in Google Workspace"). Consumer @gmail.com: none | https://support.google.com/a/answer/3407054                                                                                          |
| Members' personal inboxes                                         | No BAA possible with the co-op                                                                                                                                    | The real weak link for Medicaid-billing members (section 3).                                                                         |

**Under SHIELD** (likely applies): there's no BAA concept. 899-bb asks us to _select_ capable providers and _require safeguards by contract_. Google Cloud's and Mailgun's standard data processing terms are the likely vehicle; we did not review them here. [uncertain]

## 6. What this means for #100 tickets

- **#104 (member email):** Non-PHI content (due/birth month, services, general area from ZIP) plus a link is consistent with SHIELD minimization. It also keeps PHI out of members' non-BAA inboxes. Keep it.
- **#106 (admin email):** Full details to Mark and the co-op Gmail aren't a HIPAA violation for the co-op. Under SHIELD, though, it's another unencrypted copy of private information in mailboxes, with retention outside our control. Trimming to non-PHI plus an admin-app link is the safer default. If the FB workflow needs details, the admin app can supply them. Is the co-op Gmail consumer Gmail or Workspace? [unknown; worth checking]
- **Public form disclosure (open item):** Say plainly that requests are shared with co-op members. Don't claim "HIPAA-compliant". If NYHIPA is signed, revisit for its notice and "strictly necessary" rules.
- **Retention (open item):** 899-bb disposal duty (and NYHIPA's 60 days, if enacted) argues for a defined Firestore retention period after the 14-day portal window.

## Open questions for counsel or the user

- Does the co-op, or will it, enroll or bill as a Medicaid doula group? (Business fact; flips HIPAA.)
- Is the co-op Gmail a Workspace account with a BAA, or consumer Gmail? (Business fact.)
- Can Medicaid-billing members report Referral Outcomes to the co-op without client authorization? (Legal question.)
- S9269 status. Re-check https://www.nysenate.gov/legislation/bills/2025/S9269 before the spec is final.
