---
name: Doula Cooperative public site
description: A find-a-provider directory for Rochester doulas that works the way directories Families already use work.
colors:
  primary: "oklch(0.42 0.07 200)"
  primary-strong: "oklch(0.33 0.06 200)"
  primary-soft: "oklch(0.93 0.03 200)"
  on-primary: "oklch(0.99 0.005 200)"
  clay: "oklch(0.47 0.12 38)"
  clay-soft: "oklch(0.93 0.035 48)"
  on-clay: "oklch(0.985 0.01 60)"
  ground: "oklch(0.975 0.012 78)"
  surface: "oklch(0.995 0.004 80)"
  sand: "oklch(0.94 0.024 74)"
  line: "oklch(0.87 0.022 74)"
  line-strong: "oklch(0.74 0.03 74)"
  control-border: "oklch(0.55 0.03 74)"
  ink: "oklch(0.25 0.03 205)"
  ink-soft: "oklch(0.43 0.03 205)"
  deep: "oklch(0.22 0.03 205)"
  on-deep: "oklch(0.9 0.015 200)"
  on-deep-soft: "oklch(0.74 0.025 200)"
  deep-line: "oklch(0.34 0.03 205)"
  focus: "oklch(0.55 0.13 235)"
  error: "oklch(0.5 0.17 27)"
typography:
  display:
    fontFamily: "Geologica, sans-serif"
    fontSize: "clamp(2.1rem, 1.72rem + 1.9vw, 3.5rem)"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Geologica, sans-serif"
    fontSize: "clamp(1.55rem, 1.4rem + 0.75vw, 2.1rem)"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Geologica, sans-serif"
    fontSize: "clamp(1.35rem, 1.26rem + 0.45vw, 1.7rem)"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  subtitle:
    fontFamily: "Geologica, sans-serif"
    fontSize: "clamp(1.1875rem, 1.13rem + 0.28vw, 1.4rem)"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geologica, sans-serif"
    fontSize: "clamp(1.0625rem, 1.03rem + 0.16vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.55
  body-small:
    fontFamily: "Geologica, sans-serif"
    fontSize: "clamp(0.9375rem, 0.92rem + 0.09vw, 1rem)"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geologica, sans-serif"
    fontSize: "clamp(0.9375rem, 0.92rem + 0.09vw, 1rem)"
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: "Geologica, sans-serif"
    fontSize: "clamp(0.8125rem, 0.8rem + 0.06vw, 0.875rem)"
    fontWeight: 550
    lineHeight: 1.4
rounded:
  sm: "8px"
  control: "10px"
  md: "12px"
  pill: "999px"
spacing:
  3xs: "clamp(0.3125rem, 0.3rem + 0.0625cqi, 0.375rem)"
  2xs: "clamp(0.5625rem, 0.525rem + 0.1875cqi, 0.75rem)"
  xs: "clamp(0.875rem, 0.825rem + 0.25cqi, 1.125rem)"
  s: "clamp(1.125rem, 1.05rem + 0.375cqi, 1.5rem)"
  m: "clamp(1.6875rem, 1.575rem + 0.5625cqi, 2.25rem)"
  l: "clamp(2.25rem, 2.1rem + 0.75cqi, 3rem)"
  xl: "clamp(3.375rem, 3.15rem + 1.125cqi, 4.5rem)"
  2xl: "clamp(4.5rem, 4.2rem + 1.5cqi, 6rem)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: "0.7em 1.4em"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary-strong}"
    rounded: "{rounded.pill}"
    padding: "0.7em 1.4em"
    height: "2.75rem"
  button-secondary-hover:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-strong}"
  button-on-clay:
    backgroundColor: "{colors.on-clay}"
    textColor: "{colors.clay}"
    rounded: "{rounded.pill}"
    padding: "0.7em 1.4em"
    height: "2.75rem"
  button-on-clay-hover:
    backgroundColor: "{colors.clay-soft}"
    textColor: "{colors.clay}"
  tag:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-strong}"
    rounded: "{rounded.pill}"
    padding: "0.3em 0.8em"
  tag-link-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.6em 0.85em"
    height: "2.75rem"
  search-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0.6em 1em"
    height: "2.75rem"
  profile-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.xs}"
  choice-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.s}"
  choice-card-unsure:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  panel-sand:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.m}"
  callout:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.s} {spacing.m}"
  header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  footer:
    backgroundColor: "{colors.deep}"
    textColor: "{colors.on-deep}"
---

# Design System: Doula Cooperative public site

Scope: the public Hugo site only (`hugo/`). The Angular Members App (`members/`) and Admin App (`admin/`) keep their own older look and are not described here. Recorded from the shipped CSS in `hugo/assets/css/`; token source of truth is `colors.css`, `typography.css`, `spacing.css`.

## Overview

**Creative North Star: "The Familiar Directory"**

The site behaves like the find-a-provider directories a Family already knows: Psychology Today's directory, Zocdoc, Oula and Tia. The user chose the category standard on purpose ("we need to follow Jakob's law"). There is no metaphor and no concept world. A sticky white header carries a wordmark, three links and one Find a Doula button; pages are a warm ivory ground with white cards for people and controls; the footer is a deep teal block.

Density is moderate and content-first: one typeface, a calm two-hue palette (teal for action, warm neutrals for ground), real headshots as the only imagery besides the home photograph. Emphasis comes from weight and size, never from decoration. WCAG 2.2 AA is binding.

**Key Characteristics:**

- Conventional directory patterns: provider cards, service chips, search box, tabs, numbered steps, plain forms.
- Warm ivory ground, white surfaces, deep teal ink and action, one clay band.
- One typeface (Geologica) at 400 for reading and 650 for headings.
- 12px surfaces, pill-shaped actions and chips, 1px warm hairlines.
- One soft shadow, used for hover on linked cards and for the single action panel on a page.
- Layout responds to container width, not viewport width.

## Colors

A warm neutral ground in hue 74-80 against cool teal ink and action in hue 200-205, with one clay accent. All values are OKLCH and live in the frontmatter; the names below are the `--color-*` tokens.

### Primary

- **Deep Teal** (`primary`): filled buttons, the active nav underline and active tab, arrow icons, list markers, control hover borders, native `accent-color` and caret.
- **Teal Ink** (`primary-strong`): link text, text-link and "View profile" labels, card name links, chip text, button hover fill.
- **Teal Wash** (`primary-soft`): chip fill, step number discs, the callout, the "I'm not sure yet" choice, search-hit marks, text selection, secondary button hover.
- **On Primary** (`on-primary`): text on Deep Teal.

### Secondary

- **Clay** (`clay`): one use, the full-width Join band that closes the home page. **Clay Wash** (`clay-soft`) is its button's hover; **On Clay** (`on-clay`) is text on the band and the fill of its button.

### Neutral

- **Ivory Ground** (`ground`): page background.
- **Surface** (`surface`): header, cards, inputs, the contact panel.
- **Sand** (`sand`): quiet bands and panels (welcome band, page CTA, "what happens next"), and the placeholder behind every photo.
- **Line** (`line`): 1px hairlines on cards, row dividers, header bottom edge. Decorative only (1.46:1 on Surface).
- **Line Strong** (`line-strong`): tab hover underline, scrollbar thumb, disabled button fill. Not a control boundary (2.28:1).
- **Control Border** (`control-border`): the boundary of every input, fieldset and choice card. 4.8:1 on Surface, 4.5:1 on Ground.
- **Ink** (`ink`): body and heading text. 14.7:1 on Ground.
- **Ink Soft** (`ink-soft`): secondary text: credentials, pronouns, excerpts, ledes, placeholders. 7.4:1 on Ground, 6.7:1 on Sand.
- **Deep** (`deep`), **On Deep** (`on-deep`), **On Deep Soft** (`on-deep-soft`), **Deep Line** (`deep-line`): the footer's ground, text, column titles and divider.
- **Focus Blue** (`focus`): focus ring only.
- **Error Red** (`error`): invalid input border and message only. Defined in `components/forms.css`.

### Legacy aliases

`--brown-000/100/300/400/450/500`, `--teal-100/500/600`, `--light-bg`, `--dark-bg` and `--color-text-main` are an older scale remapped onto the tokens above so untouched page CSS follows the palette. They are not the palette. Use the `--color-*` tokens in new CSS.

### Named Rules

**The Control Border Rule.** Anything a Family types into or picks from is bounded by `control-border`, never `line` or `line-strong`. It is the only neutral border that reaches 3:1.

**The One Clay Rule.** Clay appears once per page at most, as a full-width band. It is not a button colour, a text colour or a chip colour elsewhere.

## Typography

**Display Font:** Geologica (with `sans-serif`)
**Body Font:** Geologica (with `sans-serif`)

**Character:** One self-hosted variable face (weight axis 100-900, slant fixed at 0) does everything. Geologica is here by constraint: no other typeface has been approved. Hierarchy is carried by size and weight.

### Hierarchy

- **Display** (650, `--step-5`, 1.25, -0.015em): the page h1. Centered on interior pages; start-aligned and capped at 16ch on the home hero; `text-wrap: balance`. The profile name uses `--step-4`.
- **Headline** (650, `--step-3`, 1.25): section h2 on home, the find-a-doula hub and in the reading column.
- **Title** (650, `--step-2`, 1.25): h3, the home guiding question, panel titles ("Contact", "What happens next"), profile section headings.
- **Subtitle** (650, `--step-1`, 1.25): card and row titles: doula name, choice title, FAQ question, wordmark. At 400 in Ink Soft it is the home lede.
- **Body** (400, `--step-0`, 1.55): running text. The reading column is 52ch.
- **Body small** (400, `--step--1`, 1.4-1.5): credentials, excerpts, notes, footer text.
- **Label** (600, `--step--1`, 1.4): form labels, legends, result counts, back link, small buttons. Nav links use the same size at 550.
- **Caption** (550, `--step--2`): chips inside cards, the wordmark's place line, doula counts, footer column titles (600).

Weights in use: 400 regular, 550 semibold, 600 bold, 650 boldest. The direction contract named semibold headings; the build ships 650. No uppercase transform, no tracking beyond the heading -0.015em.

### Named Rules

**The 52ch Rule.** The reading column is `52ch`, as are the page CTA, the callout and the hub intro. Geologica's `0` is wide, so 52ch sets about 70 characters a line. Short supporting copy runs narrower (40-44ch). Copy outside the reading column is capped at 60-65ch in the build (steps, home section paragraphs, the profile bio).

**The One Face Rule.** Geologica only. A second typeface needs the user's approval first.

## Layout

A single centered container (`75rem` max, `1rem` inline padding) is an inline-size container; every responsive change is a container query against it or a component's own container. Viewport media queries are used only for reduced motion.

- **Columns inside the container:** reading column `52ch`; doula lists `56rem`; search results `52rem`; hub rows, board grid and chip clouds `62rem`.
- **Two-column sections** split 0.8fr / 1.2fr (intro left, content right) at 48-56rem; the home hero is 1.15fr / 0.85fr with the photograph right; the profile is content plus a fixed `24rem` contact column at 52rem; the Match Request form is 1.1fr / 0.9fr at 60rem. Side panels are sticky at `6.5rem`.
- **Rhythm:** the `--space-*` scale (3xs to 2xl), fluid on container width. Sections are separated by `xl`; grid gaps are `s`; stacked heading-to-body gaps are `2xs`-`xs`; card padding is `xs`-`s`, panel padding `m`.
- **Bands:** a section may paint edge to edge (Sand, or Clay for Join) while its content stays in the container.
- **Header:** sticky; wordmark and CTA on one row with the nav beneath, collapsing to one row at 46rem. No hamburger menu.
- **Footer:** one column, then 2 nav columns at 30rem, then brand left and 3 nav columns right at 70rem.
- **Targets:** controls are `2.75rem` tall by default (buttons, inputs, text links). The small button is `2.5rem` and the profile Copy button `2.25rem`.

## Elevation & Depth

Nearly flat. Depth comes from tone: Surface on Ground, Sand panels, the Deep footer, and 1px Line borders. There is one shadow token.

### Shadow Vocabulary

- **Raised** (`--shadow-raised`: `0 1px 2px oklch(0.25 0.03 205 / 8%), 0 6px 16px oklch(0.25 0.03 205 / 8%)`): on hover for linked cards (doula card, search result, home choice), paired with the border turning Deep Teal; and at rest on the one action panel of a page (the profile contact panel, the membership join panel).

### Named Rules

**The One Shadow Rule.** `--shadow-raised` is the only shadow. It means "this whole surface is a link, and you are on it" or "this is the panel where you act". Sand panels, callouts, the header and inputs carry none.

## Shapes

Gently rounded and consistent. Cards, panels, fieldsets, callouts and profile photos use 12px (`--border-radius-md`). Photos inside a card step down to 8px; text inputs to 10px. Actions and chips are full pills (999px): buttons, service chips, search inputs, the Copy button. Step numbers are circles. The home photograph alone uses 24px. Headshots are always 1:1, cropped with `object-fit: cover`.

Borders are 1px. Thicker strokes mark state only: the 2px active nav underline, the 3px active tab underline, the 3px focus ring.

## Components

### Buttons

- **Shape:** full pill (999px), `2.75rem` minimum height, padding `0.7em 1.4em`, weight 600, body size.
- **Primary:** Deep Teal fill, On Primary text. Hover and focus: Teal Ink fill. 0.2s colour transition.
- **Secondary:** transparent, Teal Ink text, 1px Deep Teal border; hover fills Teal Wash. The Pagefind clear and load-more buttons and the profile Copy button follow this pattern.
- **Small:** `--step--1`, `2.5rem`; the header CTA.
- **On Clay:** On Clay fill with Clay text, hover Clay Wash. Only inside the Join band.

### Text links

- **Action link:** Teal Ink, weight 600, 1px underline at 0.2em offset, trailing arrow icon that slides 0.2em on hover. `2.75rem` tall.
- **Back link:** same without underline, arrow rotated to point back, `--step--1`.
- **Inline link:** Teal Ink in the reading column, 1px underline at 0.18em offset.
- **Arrow icon:** one 20x20 stroked SVG (1.75 stroke, round caps) in `currentColor`; the only icon motion is a 0.25s translate, removed under reduced motion.

### Chips

- **Style:** Teal Wash pill, Teal Ink text, weight 550, padding `0.3em 0.8em`. Names a Professional Service.
- **State:** a chip that is a link inverts to Deep Teal with On Primary text on hover. Static chips (inside a doula card) have no hover.
- **In a card:** one non-wrapping row of up to three; long names take an ellipsis; a plain-text "+N more" counter always stays visible. Narrow cards show the first service and the count.

### Doula card

The signature component. Surface, 1px Line border, 12px radius, `xs` padding. A fixed 1:1 headshot (`12rem`, 8px radius) sits left and sets the card's height; the text column is clamped to it: name (Subtitle, Teal Ink, one line), pronouns, credentials (one line, Ink Soft), a two-line excerpt, one row of chips, and "View profile" with the arrow pinned to the bottom. The name is the only link and stretches over the whole card; hover turns the border Deep Teal, adds the Raised shadow and underlines the name; focus rings the whole card. Below `26rem` of its own width the headshot becomes `6.5rem`, name and credentials wrap, and "View profile" drops to its own row under the photo, so the photo no longer sets the height. Lists stack cards with an `s` gap; home shows them two-up at 56rem.

### Choice card

The home page's guided question. Surface, 1px Control Border, 12px radius: title (Subtitle), one-line description, optional doula count in Teal Ink, arrow. Row on mobile, three across at 48rem. Hover as the doula card. The fallback choice ("I'm not sure yet") is Teal Wash with no border.

### Inputs / Fields

- **Style:** Surface fill, 1px Control Border, 10px radius, `2.75rem` minimum height, body-size text. Label above in Label style. Fieldsets use the same border at 12px with the legend in Label style; radio and checkbox options are `1.35rem` with native Deep Teal accent and regular-weight labels.
- **Search box:** same but a pill, with a primary button beside it. The Doula Search page restyles Pagefind's input to match.
- **Hover / Focus:** border turns Deep Teal on hover; focus is the global ring (3px Focus Blue, 2px offset).
- **Error:** Error Red border and message, shown only after a submit attempt.
- **Form grid:** one column, two at 40rem of the form's own width; submit button start-aligned.

### Navigation

- **Header:** Surface, 1px Line bottom edge, sticky. Text wordmark in two lines ("Doula Cooperative" at Subtitle, "Rochester, NY" at Caption in Ink Soft). Links at `--step--1`, weight 550, Ink; hover Deep Teal; the current section has a 2px Deep Teal underline. One small primary button, Find a Doula, at the right.
- **Tabs (Search / Browse / Match):** centered row on a 1px Line; weight 600, Ink Soft; the current tab is Ink with a 3px Deep Teal underline.
- **Footer:** Deep ground. Brand and inclusion statement left; link columns with On Deep Soft column titles and On Deep links at weight 550, underlined on hover; a Deep Line divider; copyright and language switch below.

### Rows

Questions are rows, not cards: 1px Line dividers top and bottom, title left, arrow right in Deep Teal, the whole row the target, arrow slides on hover. Used for the FAQ list and the home question list. The find-a-doula hub uses the same divided rows with a heading and note left and the path's own control right.

### Steps

A numbered list where order is the information: `2.25rem` Teal Wash disc with a Teal Ink numeral, text beside it capped at 60ch. Used for "what happens next" after a Match Request.

### Panels

- **Sand panel:** Sand fill, 12px, `m` padding, no border or shadow. The page-closing CTA (bold sentence plus one button, 52ch wide) and the "what happens next" aside.
- **Callout:** Teal Wash, 12px, icon plus one sentence with a bold Teal Ink link; 52ch wide.
- **Contact panel:** Surface, Line border, 12px, Raised shadow; title, note, one full-width primary button, then contact rows separated by Line with a Copy button. Sticky beside the profile on wide containers.

## Do's and Don'ts

### Do:

- **Do** use the patterns Families know from provider directories: card with headshot, name, credentials and chips; search box with a button; tabs; plain labelled forms.
- **Do** use `--color-control-border` for every input, fieldset and selectable card boundary.
- **Do** put long-form prose in the reading column at `52ch`.
- **Do** keep doula photos 1:1; at `26rem` and wider the photo sets the card height, with text clamped to fit beside it.
- **Do** make a card or row one link, named by its title, with the whole surface as the target.
- **Do** size layouts with container queries and the `--space-*` scale.
- **Do** honour `prefers-reduced-motion`: arrow slides, card transitions and page view transitions switch off.
- **Do** use the semantic `--color-*` tokens in new CSS.

### Don't:

- **Don't** introduce a metaphor or concept-driven visual world; the site follows Jakob's Law.
- **Don't** add a second typeface without the user's approval.
- **Don't** use `line` or `line-strong` as the only boundary of a control; neither reaches 3:1.
- **Don't** use Clay outside the one full-width band.
- **Don't** add a second shadow, or put the Raised shadow on a surface that is neither a linked card nor the page's action panel.
- **Don't** write new CSS against the `--brown-*` / `--teal-*` aliases.
- **Don't** let card text grow a card of `26rem` or wider past its photo, or drop services silently: the "+N more" count stays visible.
- **Don't** carry this system into `members/` or `admin/`; they are out of scope.
