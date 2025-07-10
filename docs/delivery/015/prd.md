# PBI-015: Contact Us Page

## Overview

This PBI covers the implementation of the "Contact Us" page, allowing visitors to reach out to the Doula Cooperative for inquiries, support, or information. The design and content are sourced from the Figma frame ([View Figma](https://www.figma.com/design/N1hDApgRTKrIRyu3RdFrFM/Doula-Cooperative?node-id=156-677)).

## Problem Statement

Visitors and prospective members need a clear, accessible way to contact the Doula Cooperative for questions, support, or special requests. A dedicated page is required to facilitate communication and ensure inquiries are handled efficiently.

## User Stories

- As a visitor, I want to contact the Doula Cooperative easily, so I can get answers to my questions or request support.
- As a user, I want to provide my name, email, and message, so the cooperative can respond to my inquiry.
- As a visitor seeking Doula Support, I want to be directed to a special request form if needed.

## Technical Approach

- Implement a new page matching the Figma design and layout
- Display all text, headings, and sections as shown in Figma
- Include input fields for Name (first and last), Email (required), and Message
- Implement a special callout for Doula Support requests, linking to the appropriate form
- Ensure the form is functional (fields can be filled and submitted; backend integration can be stubbed or handled in a future PBI)
- Show a confirmation or next steps message after submission
- Ensure the page is responsive and accessible

## UX/UI Considerations

- All content, layout, and visual elements must match the Figma frame
- Typography, colors, and spacing should be consistent with the design system
- Input fields should be clearly labeled and easy to use
- The special callout for Doula Support should be prominent
- The page must be usable on mobile and desktop devices

## Acceptance Criteria

- The "Contact Us" page matches the layout and content of the Figma frame ([View Figma](https://www.figma.com/design/N1hDApgRTKrIRyu3RdFrFM/Doula-Cooperative?node-id=156-677))
- All text, headings, and sections from Figma are present
- Input fields for Name, Email, and Message are included and labeled as shown
- Special callout for Doula Support is present and links to the correct form
- Form can be filled and submitted (backend integration can be stubbed)
- After submission, users see a confirmation or next steps message
- Page is responsive and accessible
- All content is easy to read and well-organized

## Dependencies

- Figma design: [View Figma](https://www.figma.com/design/N1hDApgRTKrIRyu3RdFrFM/Doula-Cooperative?node-id=156-677)
- Design system/styles used elsewhere on the site
- Backend integration for form submission (to be implemented in a future PBI)

## Open Questions

- What is the exact flow after submitting the form? (e.g., email notification, database entry, both?)
- Where should the Doula Support special request form link to?
- Should there be any spam prevention (e.g., CAPTCHA)?
- Are there any required fields or validation rules beyond those shown?

## Related Tasks

- [View Tasks](./tasks.md)

[View in Backlog](../backlog.md#user-content-015)
