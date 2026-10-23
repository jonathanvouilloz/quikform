---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: ["site/fr/index.html"]
---

# Landing page (site/index.html, site/fr/index.html)

Mode: Persuade. Static, GitHub Pages, EN + FR. Audience: developers who run AI agents (Claude Code, Codex, Hermès) and need to collect answers from people. Action: open the GitHub repo and build it. Proof: real captures of a rendered form (`site/img/`, synthetic brand "Northwind Climbing", made with quikform itself) next to the JSON that produced them. Constraints: claim only what v1 ships (7 field types, public links, Telegram alert, no email sending, no private links yet, build from source). Pinned brief: `design/references/landing/refs.md`. Fonts: Plus Jakarta Sans (owner's choice), system mono for code only.

## Direction contract
THESIS: One file in, one form out. The page shows the JSON an agent writes and the phone form it becomes, side by side; it refuses the SaaS hero (gradient, mockup laptop, three icon cards, metrics).
OWN-WORLD: White page, ink #141414 text, one coral #F04E37 used only as the "selected" radio dot (logo, list markers, active tab). Dark ink code panels. 1px grey rules, 8px radii like the form components, black-bordered buttons. Plus Jakarta Sans 400 text, 600 labels, 700 titles, 800 display; ui-monospace for code only. Language switch is a pill (the only non-8px radius), like the form chips at small size.
STORY: a developer understands in one viewport that an agent writes a JSON file and quikform serves a real, validated, mobile form on their own domain; scrolls through how it works, use cases, why it stays simple, what's inside; copies the build commands.
FIRST VIEWPORT: left column: logo, large bold two-line promise, one sentence, four checked facts (2×2), `quikform form put` command, GitHub button + "Install it" anchor (the README is one click from GitHub; the build steps are what a developer needs next). Right: the real phone capture of the form. Language switch top right.
FORM: brief-pinned structure (PocketBase checks row + features/code split, htmx narrow reading column and "why" questions, ntfy command-first hero and use cases). Signature interaction: radio-button tabs "definition.json / on the phone" switching JSON and capture, built from real native radios. seed: none (brief-pinned, no roll)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
