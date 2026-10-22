---
name: quikform
description: Neutral, white-label form pages that take on each project's accent and nothing else.
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
rounded:
  sm: "4px"
  md: "8px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "24px"
  field: "40px"
  step: "48px"
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
---

# Design System: quikform

## Overview

**Creative North Star: "The Borrowed Voice"**

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

## Open polish items

Known after the first build; not decisions.

- `scroll-padding-bottom` (7.5rem) ignores the iPhone safe-area inset that the sticky bar adds.
- Step title (1.25rem) and field label (1.125rem) are too close in size; the hierarchy reads flat.
- On phones, Retour sits to the right of Suivant.
- The progress track (`{colors.track}`) is about 1.2:1 on white.
- The A/B/C keyboard shortcuts are not explained to users.
- The thanks page is bare (title and one line).
