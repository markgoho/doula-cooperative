# PBI-011: Taxonomy-Driven Doula List & Canonical Profile Pages

## Overview

This PBI introduces taxonomy-driven doula list pages (e.g., by type: Birth, Postpartum) and ensures each Doula Cooperative member has a single, canonical, SEO-optimized profile page. Visitors can browse by doula type, but all links lead to the authoritative profile page for each doula.

## Problem Statement

Currently, there is no dedicated, canonical profile page for each doula, nor taxonomy-driven list pages. Visitors need a way to browse doulas by type and view authoritative, SEO-friendly profiles.

## User Stories

- As a visitor, I want to browse doulas by type (e.g., Birth, Postpartum), and when I select a doula, I am taken to their unique, canonical profile page, so I can learn more about them and ensure I’m seeing authoritative information.

## Technical Approach

- Implement taxonomy-driven list pages (e.g., /doulas/birth, /doulas/postpartum) using a template.
- Each doula has a single, canonical profile page (e.g., /doulas/jane-doe) with SEO optimization.
- All taxonomy list pages link to the canonical profile page for each doula.
- No duplicate profile pages for the same doula under different taxonomies.
- List and profile pages match the Figma design ([View Figma](https://www.figma.com/design/N1hDApgRTKrIRyu3RdFrFM/Doula-Cooperative?node-id=154-673)).

## UX/UI Considerations

- Taxonomy list pages should be visually consistent with the Figma frame.
- Profile pages must be accessible, responsive, and SEO-friendly.
- Navigation from taxonomy list to profile should be clear and intuitive.

## Acceptance Criteria

- There is a taxonomy-driven template for doula list pages (e.g., /doulas/birth, /doulas/postpartum).
- Each doula has a single, canonical profile page (e.g., /doulas/jane-doe) that is SEO-optimized and appears in search results.
- All doula list pages link to the canonical profile page for each doula.
- No duplicate profile pages exist for the same doula under different taxonomies.
- The doula list pages match the layout and content of the Figma frame ([View Figma](https://www.figma.com/design/N1hDApgRTKrIRyu3RdFrFM/Doula-Cooperative?node-id=154-673)).
- The taxonomy list pages are responsive and accessible.
- All text, buttons, and sections from Figma are present.

## Dependencies

- Figma design for doula list and profile pages.

## Open Questions

- Should profile URLs use slugs, IDs, or both for uniqueness?
- Should there be filters beyond taxonomy (e.g., location, availability)?

## Related Tasks

- [View in Backlog](../backlog.md#user-content-011)
