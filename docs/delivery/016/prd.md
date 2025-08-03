# PBI-016: Social/Meta Card Support for Doula Profile and Other Pages

## Overview

This PBI covers the implementation of consistent, customizable social/meta cards for doula profile pages (and a generic fallback for other pages) in the Hugo site. The goal is to ensure that when links are shared on Facebook, X, LinkedIn, and Instagram, a visually appealing card with the correct information is displayed. This includes generating a custom image for each doula's social card.

## Problem Statement

Currently, there is no standardized approach for defining social/meta card information for doula profile pages or other site pages. This results in poor or inconsistent appearance when links are shared on social platforms, potentially harming brand perception and user engagement.

## User Stories

- As a developer, I want to automatically generate a unique social card image for each doula profile, so that sharing these links provides a rich, visually consistent experience.
- As a developer, I want a generic fallback card for all other pages, so that every page has at least basic social/meta info when shared.
- As a site visitor, when I share a link to a doula's profile, I want to see a preview that includes their photo, name, and credentials, clearly representing who they are.

## Technical Approach

- Implement Open Graph and Twitter Card meta tags in Hugo to control social sharing appearance.
- Create a dynamic image generation process that creates a social card for each doula. This image will be generated at build time.
- The generated image will serve as the `og:image` and `twitter:image`.
- Doula profile pages will use a specific template for their social cards, pulling in the doula's name, credentials, and profile photo.
- All other pages will use a generic fallback social card (e.g., using the site logo and a standard description).
- The implementation will ensure compatibility with Facebook, X, LinkedIn, and Instagram.

## UX/UI Considerations

The visual design for the social card should be clean and professional. It must include:

- The doula's profile photo.
- The doula's full name and credentials (e.g., "Jane Doe, CD(DONA)").
- The text "Doula Cooperative" at the bottom of the card to provide branding and context.

## Acceptance Criteria

- Social cards are correctly generated and displayed when sharing links on Facebook, X, LinkedIn, and Instagram.
- Each doula profile page has a unique social card image featuring their profile photo, name, and credentials.
- The text "Doula Cooperative" is present at the bottom of each generated doula social card.
- All other pages on the site have a generic, but functional, fallback social card.
- The implementation does not significantly increase site build times.

## Dependencies

- Access to doula profile photos, full names, and credentials from the existing content files.

## Open Questions

- Should the generic fallback image/text be customizable via site config?
- Are there any other platforms to consider in the future?

## Related Tasks

- (To be defined when this PBI is moved to Agreed)

[View in Backlog](../backlog.md#user-content-016)
