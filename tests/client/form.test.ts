import { afterEach, expect, test } from "bun:test";
import steps from "../fixtures/steps.json";
import { HONEYPOT, parseDefinition } from "../../src/definition/schema";
import { activeSteps, clearDrafts, draftKey, draftPrefix, draftValues, readDraft, saveDraft, stepErrors, submitDelay, toRaw } from "../../src/client/form";
import { MIN_AGE_MS } from "../../src/definition/schema";

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
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
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
  globalThis.localStorage = { getItem: boom, setItem: boom, removeItem: boom, key: boom, get length() { return boom(); } } as unknown as Storage;
  expect(saveDraft("k", { step: 0, values: {} })).toBe(false);
  expect(readDraft("k")).toBeUndefined();
  expect(clearDrafts("qf:")).toBe(false);
});

test("submitDelay waits out the server's minimum age, counted from the page load", () => {
  expect(MIN_AGE_MS).toBe(3000);
  expect(submitDelay(10_000, 10_500)).toBe(2500);
  expect(submitDelay(10_000, 13_000)).toBe(0);
  expect(submitDelay(10_000, 20_000)).toBe(0);
});

test("clearDrafts removes every version of one form's draft and nothing else", () => {
  globalThis.localStorage = memoryStorage();
  for (const k of ["qf:h:survey:1", "qf:h:survey:2", "qf:h:survey-2:1", "qf:other:survey:1", "unrelated"]) localStorage.setItem(k, "{}");
  expect(draftPrefix("h", "survey")).toBe("qf:h:survey:");
  expect(clearDrafts("qf:h:survey:")).toBe(true);
  expect(["qf:h:survey:1", "qf:h:survey:2", "qf:h:survey-2:1", "qf:other:survey:1", "unrelated"].map((k) => localStorage.getItem(k) !== null)).toEqual([
    false, false, true, true, true,
  ]);
});
