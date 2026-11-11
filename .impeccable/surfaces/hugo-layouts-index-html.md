---
version: 1
slug: "hugo-layouts-index-html"
primary_target: "hugo/layouts/index.html"
related_targets: []
---

# Home page (hugo/layouts/index.html)

Scope: public Hugo home page, plus the global tokens, header, footer and buttons every public page inherits. Mode: Persuade.

Audience and job: a pregnant or newly postpartum Family in the Rochester area who wants to reach a doula. Action: pick a kind of support, search by name, or start a Match Request. Proof on hand: real Published Doula Profiles, the existing hero photograph, the cooperative's own copy. No testimonials or statistics exist.

User decisions (2026-11-11): rejected every concept world; "we need to follow Jakob's law". References to sit alongside: Psychology Today directory, Zocdoc, Oula / Tia. Home opens with a guided question. Typeface stays self-hosted Geologica until the user approves another.

## Direction contract

THESIS: A doula directory that behaves exactly like the find-a-provider sites a Family already knows, opened by one plain question. Refuses the full-screen photo hero with a single button, and refuses any metaphor.

OWN-WORLD: Warm ivory ground, white surfaces, deep teal ink and primary action, one clay accent band. Geologica at regular weight for reading and semibold for headings. Rounded 12px surfaces, 1px warm hairlines, soft offset shadows only on raised controls. Provider cards with square headshot, name, credentials, service chips.

STORY: The Family understands this is where Rochester doulas are found, believes the people are real and local, and takes one of three routes to contact.

FIRST VIEWPORT: Header with wordmark left, nav and a Find a Doula button right. Left column: h1 tagline, the question "What support are you looking for?", three stacked-then-row answer links (Birth doula, Postpartum doula, I'm not sure yet), then a search-by-name form and a browse-all link. Right column on desktop: the hero photograph in a rounded frame. On mobile the photograph drops below the controls.

FORM: Category standard, chosen by the user over the roll (standing exit). seed:16519dd5dac6b227

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Typeface: a serif display face like the references would need the user's approval to download.
- Spanish strings were drafted by Claude; the user accepted them without a separate review (2026-11-11).
- Search results use the stock Pagefind UI, so they cannot show credentials, service chips or a View profile link like the doula card; matching the card fully needs a custom results renderer.
- Page titles in content front matter still say "Match with a Doula" and capitalise "Doula" mid-phrase; left for the user.

## Rollout (2026-11-11)

The same world was applied to every public template in this session: doula card and profile page, find-a-doula hub with search, browse and match, service term pages, doula list, FAQ list and answers, learn, about, join, contact. The user reviewed home, card, profile and find-a-doula in the browser and approved them; the remaining pages were reported to the user and answered with "lgtm".
