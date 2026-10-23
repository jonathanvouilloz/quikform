import { expect, test } from "bun:test";
import minimal from "../fixtures/minimal.json";
import steps from "../fixtures/steps.json";
import { HONEYPOT, parseDefinition } from "../../src/definition/schema";

const clone = () => structuredClone(minimal) as any;
const errorsOf = (input: unknown) => {
  const r = parseDefinition(input);
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.errors;
};
const choice = (n: number) => ({
  id: "c",
  type: "single_choice",
  label: "C",
  options: Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `V${i}` })),
});

test("accepts a minimal one-step form", () => {
  const r = parseDefinition(minimal);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.value.steps[0]!.fields[0]!.required).toBe(false);
});

test("accepts a multi-step form with all field types and a valid showIf", () => {
  expect(parseDefinition(steps).ok).toBe(true);
});

test("rejects duplicate field ids across steps", () => {
  const d = clone();
  d.steps.push({ fields: [{ id: "name", type: "email", label: "E" }] });
  expect(errorsOf(d).join("\n")).toContain("name");
});

test("rejects the honeypot name as a field id", () => {
  const d = clone();
  d.steps[0].fields[0].id = HONEYPOT;
  expect(errorsOf(d)).toEqual([`steps.0.fields.0.id: "${HONEYPOT}" is reserved`]);
});

test("rejects choice fields without at least 2 options", () => {
  for (const n of [0, 1]) {
    const d = clone();
    d.steps[0].fields = [choice(n)];
    expect(errorsOf(d).join("\n")).toContain("options");
  }
  const d = clone();
  d.steps[0].fields = [choice(2)];
  expect(parseDefinition(d).ok).toBe(true);
});

test("rejects showIf pointing to an unknown or later field", () => {
  const unknown = clone();
  unknown.steps[0].fields[0].showIf = { field: "ghost", equals: "x" };
  expect(errorsOf(unknown).join("\n")).toContain("ghost");
  const later = clone();
  later.steps[0].fields = [
    { id: "a", type: "short_text", label: "A", showIf: { field: "b", equals: "x" } },
    { id: "b", type: "short_text", label: "B" },
  ];
  expect(errorsOf(later).join("\n")).toContain("steps.0.fields.0.showIf");
});

test("rejects unknown keys (strict)", () => {
  const top = clone();
  top.extra = 1;
  expect(errorsOf(top).length).toBeGreaterThan(0);
  const nested = clone();
  nested.steps[0].fields[0].extra = 1;
  expect(errorsOf(nested).join("\n")).toContain("steps.0.fields.0");
});

test("defaults: address formal, version 1", () => {
  const r = parseDefinition(minimal);
  expect(r.ok && r.value.address).toBe("formal");
  expect(r.ok && r.value.version).toBe(1);
});

test("error messages carry the JSON path, e.g. steps.0.fields.2.options", () => {
  const d = clone();
  d.steps[0].fields.push({ id: "b", type: "short_text", label: "B" }, choice(1));
  const errs = errorsOf(d);
  expect(errs.some((e) => e.startsWith("steps.0.fields.2.options: "))).toBe(true);
});

test("rejects malformed ids and non-object input", () => {
  const d = clone();
  d.id = "Bad Id";
  expect(errorsOf(d).join("\n")).toContain("id");
  expect(errorsOf(null).length).toBeGreaterThan(0);
});

test("unknown keys are named, a root issue reads (root)", () => {
  expect(errorsOf({ ...clone(), colour: "red" })).toEqual(["(root): unrecognized keys colour"]);
  const d = clone();
  d.steps[0].fields[0].lable = "x";
  expect(errorsOf(d)).toEqual(["steps.0.fields.0: unrecognized keys lable"]);
});

test("rejects constructor as a field id", () => {
  const d = clone();
  d.steps[0].fields[0].id = "constructor";
  expect(errorsOf(d)).toEqual([`steps.0.fields.0.id: "constructor" is reserved`]);
});

test("access is public or private, nothing else", () => {
  expect(parseDefinition({ ...clone(), access: "private" }).ok).toBe(true);
  expect(errorsOf({ ...clone(), access: "secret" })[0]).toStartWith("access:");
});

test("a missing or wrongly shaped key says what was expected", () => {
  const { thankYou: _t, ...noThanks } = clone();
  expect(errorsOf(noThanks)).toContain("thankYou: required (expected object)");
  expect(errorsOf({ ...clone(), thankYou: "Merci" })).toContain("thankYou: expected object, got string");
});
