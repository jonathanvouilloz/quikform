---
name: quikform
description: Neutral, white-label form pages that take on each project's accent and nothing else; one brand surface (the landing page) in quikform's own ink and coral.
colors:
  accent-fallback: "#111111"
  accent-hover-fallback: "#333333"
  selected-tint-fallback: "#f2f2f2"
  ink: "#1a1a1a"
  muted: "#595959"
  placeholder: "#707070"
  line: "#8a8a8a"
  track: "#ececec"
  surface: "#ffffff"
  error: "#b3261e"
  error-tint: "#fdf1f0"
  # Brand surface (landing page) only; never on form pages.
  brand-ink: "#141414"
  brand-ink-hover: "#333333"
  coral: "#f04e37"
  rule-soft: "#d9d9d6"
  wash: "#f6f6f4"
  selection-wash: "#e3e3df"
  code-ink: "#ecebe6"
  code-dim: "#9b9a94"
  code-key: "#a9a79f"
  code-str: "#f4f3ef"
typography:
  display:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "clamp(1.75rem, 1.4rem + 1.6vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  # Brand surface (landing page) only.
  brand-display:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "clamp(2.375rem, 1.5rem + 3vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  brand-headline:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "clamp(1.75rem, 1.3rem + 1.8vw, 2.75rem)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  brand-statement:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "clamp(1.125rem, 1rem + 0.5vw, 1.375rem)"
    fontWeight: 600
    lineHeight: 1.4
  brand-lede:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "clamp(1.0625rem, 1rem + 0.35vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.55
  brand-title:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.6
    letterSpacing: "-0.01em"
  brand-body:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  brand-small:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "ui-monospace, \"SF Mono\", \"Cascadia Mono\", Menlo, Consolas, monospace"
    fontSize: "0.875rem"
    lineHeight: 1.7
  mono-panel:
    fontFamily: "ui-monospace, \"SF Mono\", \"Cascadia Mono\", Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    lineHeight: 1.65
  mono-compact:
    fontFamily: "ui-monospace, \"SF Mono\", \"Cascadia Mono\", Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    lineHeight: 1.65
rounded:
  sm: "4px"
  md: "8px"
  pill: "999px"
  device: "28px"
  device-screen: "19px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "24px"
  field: "40px"
  step: "48px"
  brand-wrap: "1120px"
  brand-gutter: "clamp(20px, 4vw, 40px)"
components:
  button-primary:
    backgroundColor: "{colors.accent-fallback}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover-fallback}"
  button-back:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "48px"
  input-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    height: "48px"
  choice-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px 8px 10px"
    height: "44px"
  choice-option-selected:
    backgroundColor: "{colors.selected-tint-fallback}"
    textColor: "{colors.ink}"
  choice-key:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    size: "24px"
  error-summary:
    backgroundColor: "{colors.error-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px 20px"
  progress-bar:
    backgroundColor: "{colors.track}"
    height: "4px"
    width: "100%"
  # Brand surface (landing page) only.
  brand-button-solid:
    backgroundColor: "{colors.brand-ink}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 22px"
    height: "48px"
  brand-button-solid-hover:
    backgroundColor: "{colors.brand-ink-hover}"
  brand-button-line:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 22px"
    height: "48px"
  brand-button-line-hover:
    backgroundColor: "{colors.wash}"
  radio-tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px 8px 12px"
    height: "44px"
  radio-dot:
    backgroundColor: "{colors.coral}"
    size: "18px"
  code-panel:
    backgroundColor: "{colors.brand-ink}"
    textColor: "{colors.code-ink}"
    typography: "{typography.mono-panel}"
    rounded: "{rounded.md}"
    padding: "20px 22px"
  command-line:
    backgroundColor: "{colors.brand-ink}"
    textColor: "{colors.code-ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: "16px 20px"
  inline-code:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.sm}"
  lang-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand-ink}"
    typography: "{typography.brand-small}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  phone-frame:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.device}"
    padding: "10px"
---

# Design System: quikform

## Overview

**Creative North Star: "The Borrowed Voice"**

This file holds two surfaces. Everything up to "Do's and Don'ts" describes the white-label form pages. quikform's own brand (ink, coral dot, logo) lives on one surface only, the landing page, documented separately under "Brand surface: landing page"; its tokens are marked as brand-only in the frontmatter and never reach a form page.

quikform has no visual identity of its own to push. A form page is one white, left-aligned column of about 680 px, bold labels above outlined fields, generous air between questions, and a single brand accent supplied per project. Everything that is not the accent is neutral grey on white, so the page reads as part of whichever gym, barbershop or bakery sent the link. The pinned references are Tally for the page (column, bold labels, lettered choice chips, dark button with an arrow) and Typeform for the step mode (thin progress bar at the top, full-width thumb-reach button stuck to the bottom of the phone screen).

The page works without JavaScript; the script only adds step mode, live validation and a local draft, so the system is styled server-rendered first. It loads nothing external: the Content Security Policy is `default-src 'self'`, so the typeface (Plus Jakarta Sans) and the logo are served by quikform itself and the only icon is an inline SVG arrow. Motion is CSS only, short and small, and switched off under `prefers-reduced-motion`.

Rejected from the references: banner photos and gradients, "Made with" / "Powered by" badges, placeholder text as the only hint, underline-only fields, cookie banners.

**Key Characteristics:**
- One brand accent per project, every other color neutral.
- Plus Jakarta Sans, self-hosted, with a system fallback; no external resources.
- Labels always visible above their field, in bold.
- Flat white surface; one soft shadow, on the phone's sticky action bar.
- Touch targets of 44 px minimum (48 px for buttons and text inputs), WCAG 2.2 AA.

## Colors

A neutral grey-on-white palette with one slot for the project's brand accent and one fixed error red.

### Primary
- **Brand Accent** (per project, from `brand.accent`; falls back to near-black `{colors.accent-fallback}`): fills the primary button, the progress value, the key badge of a selected choice, and drives `accent-color` for native controls. Served as `/_qf/brand.css`, computed by `renderBrandCss` from the project's hex.
- **Derived accent set** (computed, never hand-picked): text on the accent is white when the accent reaches 4.5:1 on white, otherwise black. Hover darkens the accent 15 % toward black (white text) or lightens it 25 % toward white (black text), so hover only raises text contrast. Focus ring uses the accent when it reaches 3:1 on white, otherwise black. "Ink" (selected-choice border, caret) is the accent when it carries white text, otherwise black. Tint (selected-choice fill, text selection) is the accent mixed 90 % with white. Fallbacks without brand.css: hover `{colors.accent-hover-fallback}`, tint `{colors.selected-tint-fallback}`, focus and ink `#111`.

### Neutral
- **Ink** (`{colors.ink}`): all text, hover border on inputs, choices and the Back button.
- **Muted Grey** (`{colors.muted}`, 7:1 on white): description, help text, optional marker, step counter, draft note, privacy note.
- **Placeholder Grey** (`{colors.placeholder}`, 4.9:1): placeholder text only, which never stands in for a label.
- **Boundary Grey** (`{colors.line}`, 3.4:1): resting border of inputs, choices, key badges and the Back button (WCAG 1.4.11).
- **Track Grey** (`{colors.track}`): unfilled part of the progress bar.
- **Paper White** (`{colors.surface}`): page, fields, chips, sticky bar.

### Tertiary
- **Error Red** (`{colors.error}`, 6.5:1 on white): error messages, invalid field borders, error summary border and links. Never brand-tinted.
- **Error Wash** (`{colors.error-tint}`): error summary background only.

### Named Rules
**The Borrowed Voice Rule.** The brand accent is the only color a project can change. It appears on the primary action, progress and selected state, nowhere else; no second brand color, no tinted backgrounds, no colored headings.

**The Computed Contrast Rule.** Colors derived from the accent are computed against WCAG thresholds, never chosen by eye. A project accent that fails a threshold falls back to black for that role rather than shipping low contrast.

## Typography

**Display Font:** Plus Jakarta Sans (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** the same stack

**Character:** Plus Jakarta Sans, the owner's choice: a clean, readable sans-serif in two weights (400 and 700, 600 for links and the Back button). It is self-hosted (variable woff2, latin and latin-ext subsets, served from `/_qf/fonts/`, `font-display: swap`), so the page still loads nothing external. It has no Thai glyphs: Thai text falls back to the system fonts.

### Hierarchy
- **Display** (700, `clamp(1.75rem, 1.4rem + 1.6vw, 2.25rem)`, 1.2, -0.015em, balanced wrap): form title and thanks title, once per page.
- **Headline** (700, 1.25rem, 1.3): step title.
- **Title** (700, 1.125rem, 1.35): field label and fieldset legend.
- **Body** (400, 1rem, 1.5): inputs (never under 16 px, so iOS does not zoom on focus), choice labels, buttons (700), description (max 65ch).
- **Label** (400, 0.9375rem): help text, error text (600), step counter (tabular numbers).
- **Caption** (400, 0.875rem): privacy note, draft note, phone step counter.

### Named Rules
**The Visible Label Rule.** Every field has a bold label above it, always visible. Placeholder text is an example, never the label.

**The No Eyebrow Rule.** No small label above a title. The step counter lives in the button row, not above the step title.

## Layout

A single centered column, `max-width: 680px`, content left-aligned, padded 56 px top, 24 px sides, 64 px bottom. Header (optional logo, max 48 px tall), title, description, then the form 40 px below. Fields are separated by 40 px, steps by 48 px; label to control 8 px; choice chips stack vertically 8 px apart and hug their content on desktop.

Below 640 px: side padding 20 px, the column becomes a full-height flex column (`min-height: 100svh`) so the action bar rests on the bottom edge even on a short step; choice chips stretch to full width; the action row becomes a sticky bottom bar (12 px padding plus `env(safe-area-inset-bottom)`), the primary button grows to fill it, and the step counter drops to its own centered line under the buttons. `scroll-padding-bottom: 7.5rem` keeps keyboard focus clear of the bar (WCAG 2.4.11).

Order at the end of the form is fixed: privacy note, then the action row. The note is read before sending and stays visible above the phone's sticky bar.

## Elevation & Depth

Flat. Depth comes from 1 px grey borders and the white page, not shadows. The one shadow is on the phone's sticky action bar, separating it from content scrolling underneath. Selected and invalid states use an inset 1 px ring (a doubled border), not a lift.

### Shadow Vocabulary
- **Sticky bar edge** (`box-shadow: 0 -6px 16px -8px rgb(0 0 0 / 0.18)`): phone action bar only.

### Named Rules
**The Flat Page Rule.** Fields, chips and buttons never cast shadows. State shows as a border change, never elevation.

## Shapes

Gently rounded rectangles (`{rounded.md}`) for every interactive surface: inputs, choice chips, buttons, error summary. The letter key badge inside a chip uses a tighter radius (`{rounded.sm}`). Borders are 1 px at rest; the error summary uses a 2 px border. The progress bar is a square-ended 4 px strip across the top edge of the viewport.

## Components

Quiet, outlined and native-feeling; the accent marks only the action and the choice.

### Buttons
- **Shape:** gently rounded (`{rounded.md}`), 48 px minimum height.
- **Primary (Envoyer / Suivant):** accent fill, computed on-accent text, bold, followed by an inline 16 px SVG arrow. "Suivant" in step mode is a clone of the submit button. Full width on phones.
- **Hover / Focus:** background eases to the computed hover color (0.15 s ease-out); the arrow nudges 2 px right (0.2 s, `cubic-bezier(0.16, 1, 0.3, 1)`). Focus: 2 px outline in the focus color, 2 px offset. Disabled while sending: 0.7 opacity, progress cursor.
- **Back (Retour):** white with a 1 px grey border, ink text at 600, border turns ink on hover. Follows the primary button in tab and visual order.

### Chips (choice options)
- **Style:** white chip with a 1 px grey border, 44 px minimum height, a 24 px lettered key badge (A, B, C...) on the left; the native radio or checkbox stays focusable but visually hidden.
- **State:** hover turns the border ink; selected gets an ink border plus inset ring, tint fill, and an accent-filled key badge with on-accent letter; keyboard focus draws the focus outline around the whole chip; invalid turns the border red. Pressing the letter selects the option. Transitions 0.15 s ease-out.

### Inputs / Fields
- **Style:** white, 1 px grey border, `{rounded.md}`, 48 px minimum height (textarea 7.5rem, vertical resize only). Label above, then help text in muted grey, then the error message, then the control.
- **Focus:** border and 2 px outline in the focus color, 2 px offset.
- **Error:** red message above the control, red border plus inset red ring, `aria-invalid` and `aria-describedby` wired to the message.

### Error Summary
Shown at the top after a failed server submission (works without JavaScript): 2 px red border, error wash background, bold heading, one link per failed field followed by its message. It takes focus on load; in step mode its links jump to the right step.

### Progress Bar (signature)
Native `<progress>` fixed to the top of the viewport, 4 px, track grey with accent value; width animates 0.3 s. Hidden until the script turns on step mode, so it never shows on a one-page form or without JavaScript.

### Step Counter
"Étape 2 sur 3" in muted grey, tabular numbers, announced politely. On desktop it sits at the right end of the button row; on phones it is centered on its own line under the buttons.

### Motion
A newly shown step or conditional field fades in from 4 px below (0.2 s, `cubic-bezier(0.16, 1, 0.3, 1)`). Under `prefers-reduced-motion: reduce`, every transition and animation is removed.

## Do's and Don'ts

### Do:
- **Do** take the brand accent from the project and compute every derived color (`renderBrandCss`); keep the rest neutral.
- **Do** keep every label visible above its field, bold, at the Title size.
- **Do** keep every touch target at 44 px or more, buttons and text inputs at 48 px.
- **Do** keep inputs at 16 px or more.
- **Do** place the privacy note immediately before the action row.
- **Do** keep the step counter in the button row.
- **Do** keep motion in CSS, under 0.3 s, and removed under `prefers-reduced-motion`.

### Don't:
- **Don't** load fonts, icon fonts, CDNs or any resource from another origin; the CSP is `default-src 'self'`. Fonts and the logo are served by quikform.
- **Don't** add eyebrow labels above titles or step titles.
- **Don't** use placeholder text as the only hint, or underline-only fields.
- **Don't** add "Powered by" badges, banner photos, gradients or cookie banners.
- **Don't** add shadows to fields, chips or buttons.
- **Don't** let a project override the neutral greys or the error red.

## Brand surface: landing page

The static landing page (`site/index.html`, `site/fr/index.html`, `site/style.css`, served by GitHub Pages) is the one place quikform speaks in its own voice. Its world comes from the logo kit (`design/logo/`): a checked radio button that grows a leg into a q. Everything below applies to the landing only; the form pages keep the Borrowed Voice system above and never show the quikform logo, the coral or the brand ink.

**North Star: "The Checked Radio"**

A white page set in ink, one coral dot that only ever means "selected", dark ink code panels beside real phone captures of the form. Content is grouped by thin rules, never by cards. The page shows the JSON an agent writes and the form it becomes, side by side.

**Key Characteristics:**
- Ink (`{colors.brand-ink}`) on white; coral (`{colors.coral}`) only inside a radio dot.
- Plus Jakarta Sans 400, 600, 700 and 800, self-hosted variable woff2; the mono stack for code only.
- Gently rounded 8 px corners everywhere, plus one pill (the language switch) and the phone frame around captures.
- Flat; depth comes from rules, the ink code panels and the phone frame.
- Motion in CSS only, removed under `prefers-reduced-motion`.

### Colors

- **Brand Ink** (`{colors.brand-ink}`): all text, the solid button, button borders, the checked tab border, the radio-dot ring, focus outlines, and the background of every code panel. Same value as the logo's ink. Hover on the solid button lifts to `{colors.brand-ink-hover}`.
- **Coral** (`{colors.coral}`, 3.6:1 on white, 5.1:1 on ink): the filled centre of a radio dot. Nothing else.
- **Muted Grey** (`{colors.muted}`, 7:1): second line of the hero title, section intros, step and case descriptions, captions, footer legal text.
- **Boundary Grey** (`{colors.line}`): the language pill, unchecked tab borders and dot rings, the phone frame.
- **Soft Rule** (`{colors.rule-soft}`): 1 px rules between steps, cases and definitions, inline-code borders, the footer top edge, screenshot edges.
- **Wash** (`{colors.wash}`): footer, inline code, the line button's hover, the panel holding the two phone captures.
- **Selection Wash** (`{colors.selection-wash}`): text selection.
- **Code inks** on Brand Ink: text `{colors.code-ink}`, JSON keys `{colors.code-key}` (7.4:1), strings `{colors.code-str}`, prompts, comments and command output `{colors.code-dim}` (6.6:1). Code is set in tints of one warm grey, no syntax rainbow.

**The Selected Dot Rule.** Coral appears only as the filled centre of a radio dot: the logo, the list markers of the hero facts and the "why" questions, and the checked tab. Never text, a fill, a border, a link or a background.

**The White-Label Boundary Rule.** Brand Ink, Coral and the quikform logo stay on the landing. A form page takes the project's accent and nothing of quikform's.

### Typography

Same family as the forms, Plus Jakarta Sans (owner's choice), pushed to 800 for display. Body text adds `word-spacing: 0.04em` because the face's space reads tight at text sizes; display sizes reset it to 0.

- **Brand Display** (`{typography.brand-display}`, balanced wrap): the hero promise, two lines, the second in Muted Grey at 700.
- **Brand Headline** (`{typography.brand-headline}`, balanced wrap): section titles.
- **Brand Statement** (`{typography.brand-statement}`): the "why" questions, each led by a 14 px radio dot.
- **Brand Lede** (`{typography.brand-lede}`, max 34em): the hero sentence. Section intros sit at 1.125rem in Muted Grey, max 38em.
- **Brand Title** (`{typography.brand-title}`): use-case names. Step names use the form Title size (1.125rem, 700) led by a muted tabular counter.
- **Brand Body** (`{typography.brand-body}`): running text. Navigation, tabs and the hero facts at 0.9375rem, facts and tabs at 600.
- **Brand Small** (`{typography.brand-small}`): captions, notes, the language pill (600), tab labels on phones.
- **Mono** (`{typography.mono}`): the terminal command and inline code (0.85em). Code panels use `{typography.mono-panel}`; on phones every code block drops to `{typography.mono-compact}` and scrolls sideways rather than wrapping.

**The Code-Only Mono Rule.** The mono stack sets code, commands and field identifiers (the field lists under each use case). It never sets prose, headings, labels or buttons.

### Layout

One centered wrap of `{spacing.brand-wrap}` with `{spacing.brand-gutter}` side padding. The hero is a two-column grid (about 1.35 : 0.65), text left and the phone capture right (max 340 px). "How it works" and "Install" split 0.7 : 1.3 (prose left, code or tabs right); "What's inside" splits 1 : 1 with the code column sticky at 24 px; use cases sit in two columns; "Why" is a narrow 44rem reading column. Sections are spaced `clamp(64px, 9vw, 120px)` apart.

Below 900 px every split stacks to one column and the sticky column becomes static. Below 640 px the navigation keeps only the language pill, use cases go to one column, the action buttons go full width, the three tabs become an equal three-column grid with the dot above the label, and the two phone captures become a horizontal scroll-snap strip.

### Elevation & Depth

Flat. Structure comes from 1 px Soft Rules, the dark code panels against white, and a 2 px ink rule above the closing call to action. The only shadow-like treatments are the checked tab's inset 1 px ink ring (the same doubled border as a selected form chip) and, on phones, a light edge glow inside code panels that signals more code to the side.

### Shapes

Gently rounded rectangles (`{rounded.md}`) for buttons, tabs, code panels and the capture panel; inline code at `{rounded.sm}`. The language switch is the only pill (`{rounded.pill}`). The hero capture sits in a drawn phone frame (`{rounded.device}` outside, `{rounded.device-screen}` on the screen, concentric with its 10 px padding). Radio dots are circles: an ink ring 19 % of the dot's size, with a coral centre at 17 %.

### Components

- **Solid button** (`brand-button-solid`): ink fill, white text at 700, 1.5 px ink border, leading GitHub mark at 18 px. Hover eases to the hover ink (0.15 s ease-out).
- **Line button** (`brand-button-line`): white with a 1.5 px ink border, trailing 18 px arrow; hover fills with Wash and the arrow nudges 3 px right (0.2 s, `cubic-bezier(0.16, 1, 0.3, 1)`).
- **Radio tabs (signature)** (`radio-tab`): a fieldset of real native radios, visually hidden but focusable, each label a chip with a 16 px dot. Hover turns the border ink; checked gets an ink border plus inset ink ring and the coral centre; keyboard focus draws a 2 px ink outline, 3 px offset. Switching shows the matching panel with a 0.25 s fade up from 4 px. Without `:has()` all panels show stacked.
- **Code panel** (`code-panel`, `command-line`): ink background, code inks, `$` prompts dimmed and not selectable, scrolling sideways on overflow.
- **Language pill** (`lang-pill`): 1 px Boundary Grey border, the other language's code (FR / EN) at 600.
- **Phone frame** (`phone-frame`): white, 1 px Boundary Grey border, holding a real capture of a quikform form with a muted caption that names the sample brand.
- **Ruled lists**: steps, use cases and "What's inside" definitions separated by 1 px Soft Rules, not boxed.

### Do's and Don'ts

- **Do** use Coral only inside a radio dot.
- **Do** show real captures of quikform forms, framed as a phone, and name the sample brand in the caption.
- **Do** group content with 1 px rules, not cards.
- **Do** keep code on ink panels in the mono stack, and let it scroll sideways on phones.
- **Do** keep buttons at 48 px and tabs at 44 px minimum height.
- **Don't** add eyebrow labels above titles.
- **Don't** use Coral for text, links, fills or borders.
- **Don't** use decorative gradients; the only gradients are the drawn dot centre and the phone code panels' scroll-edge cue.
- **Don't** add shadows to buttons, tabs or panels.
- **Don't** use JavaScript for motion; tabs and panels work with native radios and CSS.
- **Don't** put the quikform logo, Coral or Brand Ink on a form page.

## Open polish items

Known after the first build; not decisions.

- `scroll-padding-bottom` (7.5rem) ignores the iPhone safe-area inset that the sticky bar adds.
- Step title (1.25rem) and field label (1.125rem) are too close in size; the hierarchy reads flat.
- On phones, Retour sits to the right of Suivant.
- The progress track (`{colors.track}`) is about 1.2:1 on white.
- The A/B/C keyboard shortcuts are not explained to users.
- The thanks page is bare (title and one line).
