# PBI-010: Integrate reCAPTCHA v3 into Contact Forms

## Overview

This PBI covers the implementation of Google reCAPTCHA v3 on all site contact forms to ensure only humans can submit them, reducing spam and abuse. The integration will cover both the "Find a Doula" page contact form and the general contact form. Both client-side and server-side (Firebase Cloud Functions) implementations are in scope.

## Problem Statement

The site is vulnerable to spam and automated submissions through its contact forms. There is currently no mechanism to distinguish between human and bot submissions, which can lead to abuse and wasted resources.

## User Stories

- As a developer, I want to integrate reCAPTCHA v3 into all contact forms so that only legitimate users can submit them, reducing spam and abuse.
- As a visitor, I want to submit contact forms without unnecessary friction, knowing my submission is protected.

## Technical Approach

- Integrate reCAPTCHA v3 on the client side for both the Find a Doula and general contact forms, following the [official documentation](https://developers.google.com/recaptcha/docs/v3).
- Use the default score threshold of 0.5 to determine if a submission is likely human.
- On form submission, obtain a reCAPTCHA token using the `grecaptcha.execute` method with an appropriate action name.
- Send the token to the backend (Firebase Cloud Function) along with the form data.
- On the server side, verify the token using the reCAPTCHA v3 siteverify API.
- If the score is below 0.5 or the verification fails, reject the submission with a user-friendly error message.
- If the score is sufficient, process the form as normal.
- Ensure the implementation is extensible for future forms.

## UX/UI Considerations

- No visible reCAPTCHA challenge or checkbox; user experience should remain seamless.
- Provide clear feedback if a submission is rejected due to suspected bot activity.
- Ensure accessibility and responsiveness are maintained.

## Acceptance Criteria

- reCAPTCHA v3 is implemented on both the Find a Doula and general contact forms.
- Client-side integration uses the official reCAPTCHA v3 API.
- Server-side verification is handled via Firebase Cloud Functions.
- Default score threshold is set to 0.5.
- Submissions with scores below threshold are rejected with a user-friendly message.
- All form submissions are protected without disrupting user experience.
- Implementation is extensible for future forms.

## Dependencies

- Google reCAPTCHA v3 site and secret keys
- Firebase Cloud Functions
- Existing contact forms (Find a Doula, general contact)

## Open Questions

- Should rejected submissions be logged for monitoring?
- Should the threshold be adjusted based on observed traffic?
- Are there any additional forms that should be protected?

## Related Tasks

- [Tasks for PBI 010](./tasks.md)

[View in Backlog](../backlog.md#user-content-010)
