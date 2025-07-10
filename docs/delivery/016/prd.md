# PBI-016: Social/Meta Card Support for Doula Profile and Other Pages

## Overview

This PBI covers the technical guidance needed to support consistent, customizable social/meta cards for doula profile pages (and a generic fallback for other pages) in the Hugo site. The goal is to ensure that when links are shared on Facebook, X, or LinkedIn, the correct information and visuals appear. Visual design is pending and will be addressed in a future PBI.

## Problem Statement

Currently, there is no standardized approach for defining social/meta card information for doula profile pages or other site pages. This can result in poor or inconsistent appearance when links are shared on social platforms.

## User Stories

- As a developer, I want to provide a single, consistent template for social/meta cards on doula profile pages, so that sharing these links always shows the correct info.
- As a developer, I want a generic fallback for all other pages, so that every page has at least basic social/meta info when shared.

## Technical Approach

- Provide technical guidance for implementing Open Graph and Twitter Card meta tags in Hugo.
- Doula profile pages should use a single, consistent template for social cards (title, description, image).
- All other pages should use a generic fallback (e.g., page title and a standard blurb/image).
- Guidance should cover Facebook, X, and LinkedIn.
- No visual design is included (pending future Figma work).

## UX/UI Considerations

- Visual design for social cards is out of scope for this PBI and will be addressed in a future PBI once Figma designs are available.

## Acceptance Criteria

- Technical guidance for Hugo meta tags is documented.
- Doula profile pages have a clear, consistent approach for social/meta cards.
- All other pages have a generic fallback for social/meta cards.
- Guidance covers Facebook, X, and LinkedIn.
- No visual design is included.

## Dependencies

- Pending Figma designs for visual appearance of social cards (future PBI).

## Open Questions

- Should the generic fallback image/text be customizable via site config?
- Are there any other platforms to consider in the future?

## Related Tasks

- (To be defined when this PBI is moved to Agreed)

[View in Backlog](../backlog.md#user-content-016)
