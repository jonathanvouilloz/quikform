import type { Field, FormDefinition } from "./schema";
import { t, type Address, type Lang, type StringKey } from "../i18n/strings";

export type { Address, Lang };
export type Values = Record<string, string | string[] | number | boolean>;

type Value = Values[string];
// value undefined and no error means "empty"
type Normalized = { value?: Value; error?: { key: StringKey; vars?: Record<string, number> } };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (key: StringKey, vars?: Record<string, number>): Normalized => ({ error: { key, vars } });

function normalize(f: Field, raw: unknown): Normalized {
  if (f.type === "multiple_choice") {
    const list = (Array.isArray(raw) ? raw : [raw]).filter((v) => v !== undefined && v !== null && v !== "");
    if (!list.length) return {};
    const allowed = f.options!.map((o) => o.value);
    return list.every((v) => allowed.includes(v)) ? { value: list as string[] } : fail("chooseOne");
  }
  if (f.type === "yes_no") {
    if (raw === "" || raw === undefined || raw === null) return {};
    if (raw === "yes" || raw === true) return { value: true };
    if (raw === "no" || raw === false) return { value: false };
    return fail("chooseOne");
  }
  if (raw === undefined || raw === null) return {};
  if (Array.isArray(raw) || typeof raw === "object") return fail("chooseOne");
  const s = String(raw).trim();
  if (s === "") return {};
  switch (f.type) {
    case "email":
      return EMAIL.test(s) ? { value: s } : fail("invalidEmail");
    case "number": {
      const n = Number(s);
      if (!Number.isFinite(n)) return fail("number");
      if (f.min !== undefined && n < f.min) return fail("min", { min: f.min });
      if (f.max !== undefined && n > f.max) return fail("max", { max: f.max });
      return { value: n };
    }
    case "single_choice":
      return f.options!.some((o) => o.value === s) ? { value: s } : fail("chooseOne");
    default:
      return f.maxLength !== undefined && [...s].length > f.maxLength ? fail("maxLength", { max: f.maxLength }) : { value: s };
  }
}

function matches(f: Field, v: Value | undefined): boolean {
  const c = f.showIf!;
  if (v === undefined) return false;
  if (c.equals !== undefined)
    return typeof v === "boolean" ? v === c.equals : typeof v === "number" ? Number(c.equals) === v : v === c.equals;
  const items = Array.isArray(v) ? v : [String(v)];
  return items.some((i) => c.in!.includes(i));
}

// Each showIf reads the normalized value of its target; a hidden target hides its dependents.
function walk(def: FormDefinition, raw: Record<string, unknown>) {
  const visible: Field[] = [];
  const normalized = new Map<string, Normalized>();
  for (const f of def.steps.flatMap((s) => s.fields)) {
    if (f.showIf && !(normalized.has(f.showIf.field) && matches(f, normalized.get(f.showIf.field)!.value))) continue;
    visible.push(f);
    normalized.set(f.id, normalize(f, raw[f.id]));
  }
  return { visible, normalized };
}

export function visibleFields(def: FormDefinition, raw: Record<string, unknown>): Field[] {
  return walk(def, raw).visible;
}

export function validateResponse(
  def: FormDefinition,
  raw: Record<string, unknown>,
  lang?: string,
): { ok: true; values: Values } | { ok: false; errors: Record<string, string> } {
  const l: Lang = (["fr", "en", "de", "th"] as const).find((x) => x === lang) ?? def.lang;
  const say = (key: StringKey, vars?: Record<string, number>) => t(l, def.address, key, vars);
  const { visible, normalized } = walk(def, raw);
  const values: Values = {};
  const errors: Record<string, string> = {};
  for (const f of visible) {
    const { value, error } = normalized.get(f.id)!;
    if (error) errors[f.id] = say(error.key, error.vars);
    else if (value === undefined) {
      if (f.required) errors[f.id] = say("required");
    } else values[f.id] = value;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}
