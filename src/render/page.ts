import { HONEYPOT, type FormDefinition } from "../definition/schema";
import { t } from "../i18n/strings";
import { escapeHtml as e } from "./escape";
import { optionId, renderField } from "./fields";
import styles from "./styles.css" with { type: "text" };

export { styles };

// `logo` is a file name inside the project folder, served at /_qf/logo.
export type Brand = { name: string; logo?: string; accent: string };

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DEFAULT_ACCENT = "#111111";
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

function rgb(hex: string): number[] {
  const h = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join("") : hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const hex = (c: number[]) => "#" + c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
const mix = (a: number[], b: number[], w: number) => a.map((x, i) => x + (b[i]! - x) * w);
function luminance(c: number[]): number {
  const [r, g, b] = c.map((x) => (x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// WCAG contrast ratio against white; every derived colour sits on the white page or carries white/black text.
const onWhite = (c: number[]) => 1.05 / (luminance(c) + 0.05);

export function renderBrandCss(brand: Brand): string {
  const accent = HEX.test(brand.accent) ? brand.accent : DEFAULT_ACCENT;
  const c = rgb(accent);
  const whiteText = onWhite(c) >= 4.5;
  const vars = {
    "--qf-accent": accent,
    "--qf-on-accent": whiteText ? "#ffffff" : "#000000",
    // Moving away from the text colour only raises the text contrast.
    "--qf-accent-hover": hex(whiteText ? mix(c, BLACK, 0.15) : mix(c, WHITE, 0.25)),
    "--qf-focus": onWhite(c) >= 3 ? accent : "#000000",
    "--qf-ink": whiteText ? accent : "#000000",
    "--qf-tint": hex(mix(c, WHITE, 0.9)),
  };
  return `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v};`).join("")}}`;
}

function page(lang: string, title: string, body: string, tail = ""): string {
  return (
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)}</title>` +
    `<link rel="stylesheet" href="/_qf/app.css"><link rel="stylesheet" href="/_qf/brand.css">${tail}</head>` +
    `<body><main class="qf">${body}</main></body></html>`
  );
}

const logo = (brand: Brand) =>
  brand.logo ? `<header class="qf-brand"><img class="qf-logo" src="/_qf/logo" alt="${e(brand.name)}"></header>` : "";

// JSON inside <script> must not contain "<", ">" or "&", or the definition could close the tag.
const embedJson = (v: unknown) =>
  JSON.stringify(v).replace(/[<>&]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

const ARROW =
  `<svg class="qf-arrow" aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M3 8h10M9 4l4 4-4 4" ` +
  `fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function renderFormPage(input: {
  def: FormDefinition;
  brand: Brand;
  values?: Record<string, unknown>;
  errors?: Record<string, string>;
  submissionId: string;
  timestamp: string;
}): string {
  const { def, brand, values = {}, errors = {} } = input;
  const say = (key: Parameters<typeof t>[2], vars?: Record<string, number>) => t(def.lang, def.address, key, vars);
  const fields = def.steps.flatMap((s) => s.fields);
  const failed = fields.filter((f) => errors[f.id]);
  const isChoice = (type: string) => type === "single_choice" || type === "multiple_choice" || type === "yes_no";
  const summary = failed.length
    ? `<div class="qf-summary" id="qf-summary" role="alert" tabindex="-1"><h2 class="qf-summary-title">${e(say("errorSummary"))}</h2><ul>` +
      failed
        .map((f) => `<li><a href="#${isChoice(f.type) ? optionId(f.id, 0) : f.id}">${e(f.label)}</a><span class="qf-summary-msg">${e(errors[f.id]!)}</span></li>`)
        .join("") +
      `</ul></div>`
    : "";
  const total = def.steps.length;
  const progress =
    total > 1
      ? `<progress class="qf-progress" data-progress max="${total}" value="1" aria-label="${e(say("stepOf", { current: 1, total }))}" hidden></progress>`
      : "";
  const steps = def.steps
    .map(
      (s, i) =>
        `<section class="qf-step" data-step="${i}">${s.title ? `<h2 class="qf-step-title">${e(s.title)}</h2>` : ""}` +
        s.fields.map((f) => renderField(f, { value: values[f.id], error: errors[f.id], lang: def.lang, address: def.address })).join("") +
        `</section>`,
    )
    .join("");
  const body =
    progress +
    logo(brand) +
    `<h1 class="qf-title">${e(def.title)}</h1>` +
    (def.description ? `<p class="qf-description">${e(def.description)}</p>` : "") +
    summary +
    `<form method="post" novalidate class="qf-form">` +
    `<input type="hidden" name="_sid" value="${e(input.submissionId)}">` +
    `<input type="hidden" name="_t" value="${e(input.timestamp)}">` +
    // Honeypot: off-screen, out of the tab order and hidden from assistive tech; only bots fill it.
    `<div class="qf-hp" aria-hidden="true"><input type="text" name="${HONEYPOT}" id="qf:${HONEYPOT}" tabindex="-1" autocomplete="off"></div>` +
    steps +
    // Privacy note before the button: read before sending, and the phone's sticky bar stays last.
    `<p class="qf-privacy">${e(def.privacy)}</p>` +
    `<div class="qf-actions" data-actions><button type="submit" class="qf-submit">${e(def.submitLabel ?? say("submit"))}${ARROW}</button></div></form>` +
    `<script type="application/json" id="qf-def">${embedJson(def)}</script>`;
  return page(def.lang, def.title, body, `<script src="/_qf/app.js" defer></script>`);
}

export function renderThankYouPage(def: FormDefinition, brand: Brand): string {
  return page(
    def.lang,
    def.thankYou.title,
    // data-qf-thanks tells the client script which form's draft to remove.
    `${logo(brand)}<h1 class="qf-title" data-qf-thanks="${e(def.id)}">${e(def.thankYou.title)}</h1><p class="qf-description">${e(def.thankYou.body)}</p>`,
    `<script src="/_qf/app.js" defer></script>`,
  );
}

export function renderNotFoundPage(): string {
  const text = t("en", "formal", "notFound");
  return page("en", text, `<h1 class="qf-title">${e(text)}</h1>`);
}
