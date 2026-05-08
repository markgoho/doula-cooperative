# ADR-0001: Form spam protection is reactive and per-form

## Status

Accepted — 2026-05-06

## Context

The site has two public form intake endpoints: the contact form and the
doula-match form. Both share a baseline of reCAPTCHA verification and
score-threshold rejection. The contact form additionally runs a honeypot
field check, gibberish detection on name and message, and a "submitted
too fast" timing check. The doula-match form runs none of these extras.

## Decision

We apply spam-protection layers reactively, per form, based on observed
spam volume. The contact form has accumulated honeypot/gibberish/timing
checks because we have observed real spam against it. The doula-match
form has not, because we have not observed spam against it — likely due
to its larger field surface (phone, due date, dropdowns) being unattractive
to common spam scripts.

A future increase in match-form spam should be answered by adding the
relevant check(s) to that form, not by uniformly applying every check
to every form.

## Consequences

- The doula-match form is a softer target than the contact form. We
  accept this risk in exchange for lower friction for legitimate
  submissions.
- The form-intake substrate exposes spam policy as a declarative input
  per form, so adding/removing a check on one form does not affect the
  other.
- Architecture reviews should not "fix" the asymmetry by unifying
  policies without checking this ADR.
