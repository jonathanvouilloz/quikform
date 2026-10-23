import { expect, test } from "bun:test";
import { parseDefinition, type Field } from "../../src/definition/schema";
import { renderField } from "../../src/render/fields";
import { escapeHtml } from "../../src/render/escape";
import { t } from "../../src/i18n/strings";

function field(f: Record<string, unknown>): Field {
  const r = parseDefinition({
    id: "f", lang: "en", title: "T", privacy: "P", thankYou: { title: "x", body: "y" },
    access: "public", notify: { telegram: false }, steps: [{ fields: [f] }],
  });
  if (!r.ok) throw new Error(r.errors.join(";"));
  return r.value.steps[0]!.fields[0]!;
}
const ctx = { lang: "en" as const, address: "formal" as const };
const opts = [{ value: "r", label: "Red" }, { value: "g", label: "Green" }, { value: "b", label: "Blue" }];

test("every field has a visible <label for=id> before its control", () => {
  for (const type of ["short_text", "long_text", "email", "number"]) {
    const html = renderField(field({ id: "q", type, label: "Question" }), ctx);
    const label = html.indexOf('<label for="q"');
    const control = html.search(/<(input|textarea)[^>]*id="q"/);
    expect(label).toBeGreaterThan(-1);
    expect(control).toBeGreaterThan(label);
    expect(html).toContain(">Question<");
  }
});

test("placeholder never replaces the label", () => {
  const html = renderField(field({ id: "q", type: "short_text", label: "Name", placeholder: "Jane" }), ctx);
  expect(html).toContain('placeholder="Jane"');
  expect(html).toMatch(/<label for="q"[^>]*>[^<]*Name/);
});

test("email -> type=email inputmode=email autocomplete=email; number -> inputmode=decimal", () => {
  const email = renderField(field({ id: "e", type: "email", label: "E" }), ctx);
  expect(email).toContain('type="email"');
  expect(email).toContain('inputmode="email"');
  expect(email).toContain('autocomplete="email"');
  expect(renderField(field({ id: "n", type: "number", label: "N" }), ctx)).toContain('inputmode="decimal"');
});

test("choices render as <fieldset><legend> with radio/checkbox, letter keys A, B, C", () => {
  const single = renderField(field({ id: "c", type: "single_choice", label: "Colour", options: opts }), { ...ctx, value: "g" });
  expect(single).toMatch(/^<fieldset[^>]*>\s*<legend[^>]*>[^<]*Colour/);
  expect(single.match(/type="radio"/g)).toHaveLength(3);
  for (const k of ["A", "B", "C"]) expect(single).toContain(`data-key="${k}"`);
  expect(single).toMatch(/value="g"[^>]* checked/);
  expect(single).not.toMatch(/value="r"[^>]* checked/);

  const multi = renderField(field({ id: "m", type: "multiple_choice", label: "M", options: opts }), { ...ctx, value: ["r", "b"] });
  expect(multi.match(/type="checkbox"/g)).toHaveLength(3);
  expect(multi.match(/ checked/g)).toHaveLength(2);

  const yn = renderField(field({ id: "y", type: "yes_no", label: "Y" }), { ...ctx, value: true });
  expect(yn).toContain(`>${t("en", "formal", "yes")}<`);
  expect(yn).toContain(`>${t("en", "formal", "no")}<`);
  expect(yn).toMatch(/value="yes"[^>]* checked/);
});

test("error -> aria-invalid=true and aria-describedby pointing to the error id", () => {
  const html = renderField(field({ id: "q", type: "short_text", label: "Q", help: "Some help" }), { ...ctx, error: "Required." });
  const describedby = html.match(/<input[^>]*aria-describedby="([^"]+)"/)![1]!.split(" ");
  expect(html).toMatch(/<input[^>]*aria-invalid="true"/);
  for (const id of describedby) expect(html).toContain(`id="${id}"`);
  const errorId = describedby.find((id) => html.includes(`id="${id}" class="qf-error"`));
  expect(errorId).toBeDefined();
  expect(html).toContain(">Required.<");

  const choice = renderField(field({ id: "c", type: "single_choice", label: "C", options: opts }), { ...ctx, error: "Pick one." });
  expect(choice.match(/<input[^>]*aria-invalid="true"/g)).toHaveLength(3);
  expect(choice).toMatch(/<fieldset[^>]*aria-describedby="c:error"/);
  expect(choice).toContain('id="c:error"');
});

test("'<script>alert(1)</script>' in label and in value renders escaped", () => {
  const evil = `<script>alert(1)</script>"'&`;
  const esc = escapeHtml(evil);
  expect(esc).toBe("&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#39;&amp;");
  for (const type of ["short_text", "long_text"]) {
    const html = renderField(field({ id: "q", type, label: evil, help: evil, placeholder: evil }), { ...ctx, value: evil, error: evil });
    expect(html).not.toContain("<script");
    expect(html).not.toContain(`"'`);
    expect(html).toContain(esc);
  }
  const choice = renderField(field({ id: "c", type: "single_choice", label: evil, options: [{ value: evil, label: evil }, { value: "x", label: "X" }] }), ctx);
  expect(choice).not.toContain("<script");
});
