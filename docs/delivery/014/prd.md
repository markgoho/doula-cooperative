# PBI-014: Join the Doula Cooperative

## Overview

This PBI covers the implementation of the "Join the Doula Cooperative" page, which allows visitors to learn about the benefits of membership and join the cooperative online. The design and content are sourced from the Figma frame ([View Figma](https://www.figma.com/design/N1hDApgRTKrIRyu3RdFrFM/Doula-Cooperative?node-id=155-676)).

## Problem Statement

Doulas and birth professionals often work in isolation, lacking a supportive community and access to professional development. The Doula Cooperative aims to provide a space for connection, mentorship, and growth. A dedicated page is needed to communicate these benefits and facilitate membership.

## User Stories

- As a visitor, I want to learn about the benefits of joining the Doula Cooperative and be able to join online, so I can become part of a supportive professional community.

## Technical Approach

- Implement a new page matching the Figma design and layout
- Display all text, headings, and sections as shown in Figma
- List membership benefits and details (e.g., "Doula Membership, 1 Year", price)
- Implement a "Join the Cooperative" button that initiates the membership process (e.g., form, payment, or registration flow)
- The intended payment/subscription provider is Stripe; the button should eventually link to a Stripe subscription page (pending Stripe integration in a future PBI)
- Show a confirmation or next steps message after joining
- Ensure the page is responsive and accessible

## UX/UI Considerations

- All content, layout, and visual elements must match the Figma frame
- Typography, colors, and spacing should be consistent with the design system
- The "Join the Cooperative" button should be prominent and easy to find
- Membership benefits should be clearly listed and easy to read
- The page must be usable on mobile and desktop devices

## Acceptance Criteria

- The "Join the Doula Cooperative" page matches the layout and content of the Figma frame ([View Figma](https://www.figma.com/design/N1hDApgRTKrIRyu3RdFrFM/Doula-Cooperative?node-id=155-676))
- All text, headings, and sections from Figma are present
- Membership benefits are clearly listed as shown in Figma
- Membership details (e.g., "Doula Membership, 1 Year", price) are displayed
- "Join the Cooperative" button is present and functional
- The button should eventually link to a Stripe subscription page (pending Stripe integration)
- After joining, users see a confirmation or next steps message
- Page is responsive and accessible
- All content is easy to read and well-organized

## Dependencies

- Figma design: [View Figma](https://www.figma.com/design/N1hDApgRTKrIRyu3RdFrFM/Doula-Cooperative?node-id=155-676)
- Design system/styles used elsewhere on the site
- Stripe integration for payment/subscription flow (to be implemented in a future PBI)

## Open Questions

- What is the exact flow after clicking "Join the Cooperative"? (e.g., payment, registration, both?)
- Are there any eligibility requirements for membership?
- Should the confirmation message include additional onboarding steps?
- Will Stripe be used for all membership payments? (Reference: Stripe integration to be handled in a future PBI)

## Related Tasks

- [View Tasks](./tasks.md)

[View in Backlog](../backlog.md#user-content-014)
