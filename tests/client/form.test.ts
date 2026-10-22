import { afterEach, expect, test } from "bun:test";
import steps from "../fixtures/steps.json";
import { HONEYPOT, parseDefinition } from "../../src/definition/schema";
import { activeSteps, draftKey, draftValues, readDraft, saveDraft, stepErrors, toRaw } from "../../src/client/form";

const parsed = parseDefinition(steps);
if (!parsed.ok) throw new Error(parsed.errors.join());
const def = parsed.value;
// Same shape of definition with a third step that only exists when "contacted" is yes.
const three = parseDefinition({
  ...steps,
  steps: [...steps.steps, { fields: [{ id: "why", type: "short_text", label: "Pourquoi ?", required: true, showIf: { field: "contacted", equals: true } }] }],
});
if (!three.ok) throw new Error(three.errors.join());

test("toRaw reads FormData like the server: repeated names become arrays", () => {
  const fd = new FormData();
  fd.append("name", "Ana");
  fd.append("tags", "a");
  fd.append("tags", "b");
  fd.append("color", "r");
  expect(toRaw(fd)).toEqual({ name: "Ana", tags: ["a", "b"], color: "r" });
});

test("stepErrors only reports the fields of that step", () => {
  const raw = { name: "", email: "bad", color: "x" };
  expect(stepErrors(def, raw, 0)).toEqual({ name: "Ce champ est requis.", email: "Vérifie ton adresse email." });
  expect(Object.keys(stepErrors(def, raw, 1))).toEqual(["color"]);
  expect(stepErrors(def, { name: "Ana" }, 0)).toEqual({});
});

test("a required field hidden by showIf never blocks its step", () => {
  expect(stepErrors(three.value, { name: "Ana", contacted: "no" }, 2)).toEqual({});
  expect(stepErrors(three.value, { name: "Ana", contacted: "yes" }, 2)).toEqual({ why: "Ce champ est requis." });
});

test("activeSteps skips a step whose fields are all hidden", () => {
  expect(activeSteps(three.value, { contacted: "no" })).toEqual([0, 1]);
  expect(activeSteps(three.value, { contacted: "yes" })).toEqual([0, 1, 2]);
});

test("draftKey is qf:<host>:<form>:<version>", () => {
  expect(draftKey("forms.acme.test", def)).toBe("qf:forms.acme.test:survey:2");
});

test("draftValues drops the honeypot, _sid and _t", () => {
  expect(draftValues({ name: "Ana", _sid: "x", _t: "y", [HONEYPOT]: "spam", tags: ["a"] })).toEqual({ name: "Ana", tags: ["a"] });
});

const realStorage = globalThis.localStorage;
afterEach(() => {
  globalThis.localStorage = realStorage;
});
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as Storage;
}

test("a saved draft reads back; corrupt or missing drafts read as undefined", () => {
  globalThis.localStorage = memoryStorage();
  expect(saveDraft("k", { step: 1, values: { name: "Ana" } })).toBe(true);
  expect(readDraft("k")).toEqual({ step: 1, values: { name: "Ana" } });
  expect(readDraft("other")).toBeUndefined();
  localStorage.setItem("k", "{not json");
  expect(readDraft("k")).toBeUndefined();
  localStorage.setItem("k", JSON.stringify({ step: "1", values: null }));
  expect(readDraft("k")).toBeUndefined();
});

test("blocked storage never throws", () => {
  const boom = () => {
    throw new Error("SecurityError");
  };
  globalThis.localStorage = { getItem: boom, setItem: boom, removeItem: boom } as unknown as Storage;
  expect(saveDraft("k", { step: 0, values: {} })).toBe(false);
  expect(readDraft("k")).toBeUndefined();
});
