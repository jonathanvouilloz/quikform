import { expect, test } from "bun:test";
import { parseDefinition, type FormDefinition } from "../../src/definition/schema";
import { renderBrandCss, renderFormPage, renderNotFoundPage, renderThankYouPage, styles } from "../../src/render/page";
import { t } from "../../src/i18n/strings";
import steps from "../fixtures/steps.json";
import minimal from "../fixtures/minimal.json";

function def(input: unknown): FormDefinition {
  const r = parseDefinition(input);
  if (!r.ok) throw new Error(r.errors.join(";"));
  return r.value;
}
const brand = { name: "Acme", accent: "#0055aa" };
const base = { brand, submissionId: "0b8f6a9e-1c1e-4c39-9a52-7f0f3c1d2e4a", timestamp: "123.sig" };

test("one step -> single page, no progress bar; several steps -> all steps rendered as <section data-step> (no-JS fallback)", () => {
  const one = renderFormPage({ ...base, def: def(minimal) });
  expect(one.match(/<section[^>]*data-step/g)).toHaveLength(1);
  expect(one).not.toContain("data-progress");
  const many = renderFormPage({ ...base, def: def(steps) });
  expect(many.match(/<section[^>]*data-step/g)).toHaveLength(2);
  expect(many).toContain("data-progress");
  expect(many.match(/type="submit"/g)).toHaveLength(1);
  expect(many).toMatch(/<form method="post" novalidate/);
  expect(many).toContain('<html lang="fr"');
});

test("page includes honeypot input name=website (hidden from users and AT), hidden _sid and _t", () => {
  const html = renderFormPage({ ...base, def: def(minimal), timestamp: `1"><b>` });
  expect(html).toMatch(/<div class="qf-hp" aria-hidden="true">\s*<input[^>]*name="website"[^>]*tabindex="-1"/);
  expect(html).toContain(`<input type="hidden" name="_sid" value="${base.submissionId}">`);
  expect(html).toContain(`<input type="hidden" name="_t" value="1&quot;&gt;&lt;b&gt;">`);
});

test("privacy note comes before the submit button and the actions close the form", () => {
  const html = renderFormPage({ ...base, def: def(minimal) });
  expect(html).toMatch(/<p class="qf-privacy">[^<]*<\/p><div class="qf-actions" data-actions>.*?<\/div><\/form>/);
});

test("page has no external URL in src/href; a brand logo is served from /_qf/logo", () => {
  const pages = [
    renderFormPage({ ...base, brand: { ...brand, logo: "logo.png" }, def: def(steps), errors: { name: "x" } }),
    renderThankYouPage(def(minimal), { ...brand, logo: "logo.png" }),
    renderNotFoundPage(),
  ];
  for (const html of pages) {
    const urls = [...html.matchAll(/(?:src|href)="([^"]*)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u).toMatch(/^[/#]/);
    expect(html).toContain('href="/_qf/app.css"');
    expect(html).toContain('href="/_qf/brand.css"');
    expect(html).not.toMatch(/\sstyle=|<style/);
  }
  expect(pages[0]).toContain('<script src="/_qf/app.js" defer></script>');
  expect(pages[0]).toContain('<img class="qf-logo" src="/_qf/logo" alt="Acme">');
  expect(pages[1]).toContain('<img class="qf-logo" src="/_qf/logo" alt="Acme">');
  expect(renderThankYouPage(def(minimal), brand)).not.toContain("<img");
});

test("definition is embedded as JSON that cannot break out of its script tag", () => {
  const d = def({ ...minimal, title: "</script><script>alert(1)</script>&" });
  const html = renderFormPage({ ...base, def: d });
  const json = html.match(/<script type="application\/json" id="qf-def">([^<]*)<\/script>/)![1]!;
  expect(json).not.toMatch(/[<>&]/);
  expect(JSON.parse(json).title).toBe(d.title);
});

test("brand.accent is applied as --qf-accent and only accepts #rgb/#rrggbb", () => {
  expect(renderBrandCss({ ...brand, accent: "#0055aa" })).toContain("--qf-accent:#0055aa;");
  expect(renderBrandCss({ ...brand, accent: "#05A" })).toContain("--qf-accent:#05A;");
  const fallback = renderBrandCss({ ...brand, accent: "#111111" });
  for (const bad of ["red", "#12345", "#0055aazz", "#05a;}body{x:y", "url(x)", ""])
    expect(renderBrandCss({ ...brand, accent: bad })).toBe(fallback);
  // dark accent: white text; light accent: black text and black focus/ink
  expect(renderBrandCss({ ...brand, accent: "#0055aa" })).toContain("--qf-on-accent:#ffffff;");
  const light = renderBrandCss({ ...brand, accent: "#ffee00" });
  expect(light).toContain("--qf-on-accent:#000000;");
  expect(light).toContain("--qf-focus:#000000;");
  expect(light).toContain("--qf-ink:#000000;");
});

test("errors -> summary at top with links to each field", () => {
  const d = def(steps);
  const errors = { color: "Pick one.", name: "Required." };
  const html = renderFormPage({ ...base, def: d, errors, values: { name: "", email: "a@b" } });
  const summary = html.indexOf('role="alert"');
  expect(summary).toBeGreaterThan(-1);
  expect(summary).toBeLessThan(html.indexOf("data-step"));
  expect(html).toContain(t("fr", "informal", "errorSummary"));
  const links = [...html.slice(summary).matchAll(/<a href="#([^"]+)"/g)].map((m) => m[1]);
  expect(links).toEqual(["name", "color:0"]); // definition order; choice -> first input
  expect(html).toContain('id="color:0"');
  expect(html).toContain('value="a@b"');
  expect(renderFormPage({ ...base, def: d })).not.toContain('role="alert"');
});

test("thank-you and not-found pages", () => {
  const ty = renderThankYouPage(def(minimal), brand);
  expect(ty).toContain(">Thanks<");
  expect(ty).toContain(">We received your message.<");
  expect(renderNotFoundPage()).toContain(t("en", "formal", "notFound"));
});

test("styles are exported as CSS text", () => {
  expect(styles).toContain(".qf-submit");
});

test("the thanks page loads the client script and names its form, so the draft can be cleared there", () => {
  const ty = renderThankYouPage(def(minimal), brand);
  expect(ty).toContain(`<script src="/_qf/app.js" defer></script>`);
  expect(ty).toContain(`data-qf-thanks="contact"`);
});
