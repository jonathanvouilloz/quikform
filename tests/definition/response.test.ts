import { expect, test } from "bun:test";
import { parseDefinition, type Field } from "../../src/definition/schema";
import { validateResponse, visibleFields } from "../../src/definition/response";
import { t } from "../../src/i18n/strings";

function make(fields: Record<string, unknown>[], lang = "en", address = "formal") {
  const r = parseDefinition({
    id: "f", lang, address, title: "T", privacy: "P",
    thankYou: { title: "x", body: "y" }, access: "public", notify: { telegram: false },
    steps: [{ fields }],
  });
  if (!r.ok) throw new Error(r.errors.join(";"));
  return r.value;
}
const opts = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

test("required empty field -> errors.name === t('en','formal','required')", () => {
  const d = make([{ id: "name", type: "short_text", label: "N", required: true }]);
  expect(validateResponse(d, { name: "  " })).toEqual({ ok: false, errors: { name: t("en", "formal", "required") } });
});

test("email is trimmed and validated", () => {
  const d = make([{ id: "e", type: "email", label: "E" }]);
  expect(validateResponse(d, { e: " a@b.co " })).toEqual({ ok: true, values: { e: "a@b.co" } });
  expect(validateResponse(d, { e: "nope" })).toEqual({ ok: false, errors: { e: t("en", "formal", "invalidEmail") } });
});

test("number field coerces '12' to 12 and checks min/max", () => {
  const d = make([{ id: "n", type: "number", label: "N", min: 5, max: 20 }]);
  expect(validateResponse(d, { n: "12" })).toEqual({ ok: true, values: { n: 12 } });
  expect(validateResponse(d, { n: 3 })).toEqual({ ok: false, errors: { n: t("en", "formal", "min", { min: 5 }) } });
  expect(validateResponse(d, { n: "21" })).toEqual({ ok: false, errors: { n: t("en", "formal", "max", { max: 20 }) } });
  expect(validateResponse(d, { n: "abc" })).toEqual({ ok: false, errors: { n: t("en", "formal", "number") } });
});

test("maxLength is enforced", () => {
  const d = make([{ id: "s", type: "short_text", label: "S", maxLength: 3 }]);
  expect(validateResponse(d, { s: "abcd" })).toEqual({ ok: false, errors: { s: t("en", "formal", "maxLength", { max: 3 }) } });
});

test("single_choice rejects a value not in options", () => {
  const d = make([{ id: "c", type: "single_choice", label: "C", options: opts }]);
  expect(validateResponse(d, { c: "b" })).toEqual({ ok: true, values: { c: "b" } });
  expect(validateResponse(d, { c: "z" })).toEqual({ ok: false, errors: { c: t("en", "formal", "chooseOne") } });
});

test("multiple_choice accepts string or string[] and returns string[]", () => {
  const d = make([{ id: "m", type: "multiple_choice", label: "M", options: opts }]);
  expect(validateResponse(d, { m: "a" })).toEqual({ ok: true, values: { m: ["a"] } });
  expect(validateResponse(d, { m: ["a", "b"] })).toEqual({ ok: true, values: { m: ["a", "b"] } });
  expect(validateResponse(d, { m: ["a", "z"] }).ok).toBe(false);
});

test("yes_no maps 'yes'/'no' and booleans", () => {
  const d = make([{ id: "y", type: "yes_no", label: "Y", required: true }]);
  expect(validateResponse(d, { y: "yes" })).toEqual({ ok: true, values: { y: true } });
  expect(validateResponse(d, { y: "no" })).toEqual({ ok: true, values: { y: false } });
  expect(validateResponse(d, { y: false })).toEqual({ ok: true, values: { y: false } });
});

test("empty optional values are dropped", () => {
  const d = make([{ id: "s", type: "short_text", label: "S" }, { id: "m", type: "multiple_choice", label: "M", options: opts }]);
  expect(validateResponse(d, { s: "", m: [] })).toEqual({ ok: true, values: {} });
});

test("hidden required field (showIf false) does not block and is dropped from values", () => {
  const d = make([
    { id: "y", type: "yes_no", label: "Y" },
    { id: "why", type: "short_text", label: "W", required: true, showIf: { field: "y", equals: true } },
  ]);
  expect(validateResponse(d, { y: "no", why: "stale" })).toEqual({ ok: true, values: { y: false } });
  expect(validateResponse(d, { y: "yes" }).ok).toBe(false);
});

test("yes_no 'no' -> showIf {equals:false} visible", () => {
  const d = make([
    { id: "y", type: "yes_no", label: "Y" },
    { id: "z", type: "short_text", label: "Z", showIf: { field: "y", equals: false } },
  ]);
  expect(visibleFields(d, { y: "no" }).map((f: Field) => f.id)).toEqual(["y", "z"]);
  expect(visibleFields(d, { y: "yes" }).map((f: Field) => f.id)).toEqual(["y"]);
});

test("showIf is transitive: a field depending on a hidden field is hidden", () => {
  const d = make([
    { id: "a", type: "single_choice", label: "A", options: opts },
    { id: "b", type: "short_text", label: "B", showIf: { field: "a", equals: "a" } },
    { id: "c", type: "short_text", label: "C", showIf: { field: "b", in: ["x"] } },
  ]);
  expect(visibleFields(d, { a: "b", b: "x" }).map((f: Field) => f.id)).toEqual(["a"]);
  expect(visibleFields(d, { a: "a", b: "x" }).map((f: Field) => f.id)).toEqual(["a", "b", "c"]);
});

test("showIf in matches any value of a multiple_choice", () => {
  const d = make([
    { id: "m", type: "multiple_choice", label: "M", options: opts },
    { id: "z", type: "short_text", label: "Z", showIf: { field: "m", in: ["b"] } },
  ]);
  expect(visibleFields(d, { m: ["a", "b"] }).length).toBe(2);
  expect(visibleFields(d, { m: "a" }).length).toBe(1);
});

test("Thai text and emoji are kept intact", () => {
  const d = make([{ id: "s", type: "long_text", label: "S" }]);
  const s = "สวัสดีครับ 👨‍👩‍👧 ☕";
  expect(validateResponse(d, { s })).toEqual({ ok: true, values: { s } });
});

test("fr formal: required and invalidEmail messages; lang override and fallback", () => {
  const d = make([{ id: "n", type: "short_text", label: "N", required: true }, { id: "e", type: "email", label: "E" }], "fr");
  expect(validateResponse(d, { e: "x" })).toEqual({ ok: false, errors: { n: "Ce champ est requis.", e: "Vérifiez votre adresse email." } });
  expect(validateResponse(d, { e: "x" }, "en")).toMatchObject({ errors: { n: "This field is required." } });
  expect(validateResponse(d, { e: "x" }, "xx")).toMatchObject({ errors: { n: "Ce champ est requis." } });
  const inf = make([{ id: "e", type: "email", label: "E" }], "fr", "informal");
  expect(validateResponse(inf, { e: "x" })).toEqual({ ok: false, errors: { e: "Vérifie ton adresse email." } });
});

test("number accepts a decimal comma, rejects hex and exponents", () => {
  const d = make([{ id: "n", type: "number", label: "N" }]);
  expect(validateResponse(d, { n: " 12,5 " })).toEqual({ ok: true, values: { n: 12.5 } });
  expect(validateResponse(d, { n: "-3.25" })).toEqual({ ok: true, values: { n: -3.25 } });
  for (const n of ["0x10", "1e3", "12,", "1.2.3"]) expect(validateResponse(d, { n })).toEqual({ ok: false, errors: { n: t("en", "formal", "number") } });
});

test("CRLF line breaks count as one character and are stored as \\n", () => {
  const d = make([{ id: "m", type: "long_text", label: "M", maxLength: 3 }]);
  expect(validateResponse(d, { m: "a\r\nb" })).toEqual({ ok: true, values: { m: "a\nb" } });
  expect(validateResponse(d, { m: "a\rb" })).toEqual({ ok: true, values: { m: "a\nb" } });
});
