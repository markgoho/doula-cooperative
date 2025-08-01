# PBI-018: Implement Static Search Functionality

[View in Backlog](../backlog.md#user-content-018)

## Overview

This PBI implements static search functionality across the entire Doula Cooperative website using Pagefind, a fully static search library that performs well on large sites while minimizing bandwidth usage. The search feature will allow visitors to quickly find relevant information about doulas, services, and support without requiring any server-side infrastructure.

## Problem Statement

Currently, the Find a Doula page has a search form placeholder that is non-functional. Visitors cannot search across the site's content, making it difficult to find specific doulas, services, or information quickly. With over 50 doula profiles and growing content across multiple pages, visitors need an efficient way to search and discover relevant information.

## User Stories

- As a visitor, I want to search for doulas by name, specialization, or location, so I can quickly find the right support for my needs
- As a visitor, I want to search for specific services or information across the site, so I can learn about available support options
- As a visitor, I want search results to load quickly and show relevant snippets, so I can determine which results to explore
- As a visitor using assistive technology, I want the search to be accessible and keyboard-navigable, so I can use it effectively

## Technical Approach

### 1. Pagefind Integration

Pagefind is a static search library that:

- Runs after Hugo builds the site
- Generates a static search index from the HTML output
- Provides both a prebuilt UI and a JavaScript API
- Requires no server-side infrastructure
- Optimizes for minimal bandwidth usage (compressed index)

### 2. Build Process Integration

- Add Pagefind to the build pipeline after Hugo generates the site
- Use `npx pagefind --site public` to index the built site
- Configure Pagefind to index content within `<main>` elements
- Generate search index in the `public/_pagefind` directory

### 3. Search UI Implementation

Replace the placeholder search form in `hugo/layouts/partials/find-a-doula/search.html` with:

- Pagefind's prebuilt UI component for quick implementation
- Custom styling to match the site's design system
- Progressive enhancement approach (fallback to external search if JS fails)

### 4. Search Scope and Indexing

Configure Pagefind to index:

- All doula profile pages (names, bios, specializations, locations)

### 5. Performance Optimization

- Lazy load search functionality (only load when search is initiated)
- Use Pagefind's compressed index format
- Configure appropriate chunk sizes for the index
- Implement proper caching headers for search assets

## UX/UI Considerations

### Search Interface

- Maintain the existing search form design from the Figma mockup
- Add auto-complete suggestions as users type
- Display search results in an overlay or dedicated results area
- Show result count and search query

### Search Results

- Display page title, relevant snippet, and URL
- Highlight matching terms in results
- Group results by type (Doulas, Services, Information)
- Provide clear navigation back to search or to results

### Accessibility

- Ensure search input has proper ARIA labels
- Make results keyboard navigable
- Announce result count to screen readers
- Provide clear focus indicators

### Mobile Experience

- Optimize search overlay for mobile screens
- Ensure touch-friendly result links
- Consider mobile keyboard behavior

## Acceptance Criteria

1. **Search Indexing**
   - Pagefind successfully indexes all public HTML pages after Hugo build
   - Search index includes doula profiles, service pages, and informational content
   - Index excludes navigation, headers, footers, and other non-content elements
   - Build process automatically regenerates index on content changes

2. **Search Functionality**
   - Search input on Find a Doula page is functional
   - Users can search by doula names, specializations, locations, and keywords
   - Search returns relevant results with snippets
   - Results link to the correct pages

3. **Performance**
   - Search index loads only when search is initiated (lazy loading)
   - Initial search response time is under 500ms
   - Total search bundle size is optimized (target under 500KB compressed)
   - Search works efficiently even with 100+ indexed pages

4. **User Experience**
   - Search UI matches site design and is intuitive to use
   - Results display clearly with relevant information
   - Mobile experience is optimized
   - Search provides helpful feedback (no results, loading states)

5. **Accessibility**
   - Search meets WCAG 2.1 AA standards
   - Full keyboard navigation support
   - Screen reader compatibility
   - Proper ARIA labels and announcements

6. **Integration**
   - Search functionality integrates seamlessly with existing site
   - No breaking changes to current functionality
   - Fallback behavior if JavaScript is disabled
   - Works across all supported browsers

## Dependencies

- Hugo static site generator (already in use)
- bun for running Pagefind via npx
- No server-side dependencies required

## Open Questions

1. Should we implement search on all pages or just the Find a Doula page initially?
2. Do we want to customize the search UI beyond Pagefind's default, or start with the prebuilt UI?
3. Should search results show thumbnail images for doula profiles?
4. Do we need search analytics to understand what visitors are searching for?
5. Should we implement search filters (by doula type, location, etc.) in addition to text search?

## Related Tasks

Tasks will be created upon PBI approval to cover:

1. Installing and configuring Pagefind in the build process
2. Implementing the search UI on the Find a Doula page
3. Styling and customizing the search experience
4. Testing search functionality across devices and browsers
5. Documenting the search implementation for future maintenance
