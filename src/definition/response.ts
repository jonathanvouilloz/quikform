import * as z from "zod/mini";
import type { Field, FormDefinition } from "./schema";
import { t, type Address, type Lang, type StringKey } from "../i18n/strings";

export type { Address, Lang };
export type Values = Record<string, string | string[] | number | boolean>;

type Value = Values[string];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Raw input to the shape the schema expects; empty becomes undefined. Unparseable input is left as is so the schema rejects it.
function coerce(f: Field, raw: unknown): unknown {
  if (f.type === "multiple_choice") {
    const list = (Array.isArray(raw) ? raw : [raw]).filter((v) => v !== undefined && v !== null && v !== "");
    return list.length ? list : undefined;
  }
  if (typeof raw === "boolean") return f.type === "yes_no" ? raw : undefined;
  if (typeof raw !== "string") return raw ?? undefined;
  // Browsers send CRLF for textarea line breaks; maxLength counts one character per break.
  const s = f.type === "yes_no" ? raw : raw.replace(/\r\n?/g, "\n").trim();
  if (s === "") return undefined;
  if (f.type === "yes_no") return s === "yes" ? true : s === "no" ? false : s;
  // Plain decimals only, with a point or the comma fr/de keyboards show; Number() would also take "0x10" or "1e3".
  return f.type === "number" && /^-?\d+([.,]\d+)?$/.test(s) ? Number(s.replace(",", ".")) : s;
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
  const normalized = new Map<string, unknown>();
  for (const f of def.steps.flatMap((s) => s.fields)) {
    if (f.showIf && !(normalized.has(f.showIf.field) && matches(f, normalized.get(f.showIf.field) as Value | undefined))) continue;
    visible.push(f);
    normalized.set(f.id, coerce(f, raw[f.id]));
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
  const bad = (key: StringKey) => (iss: { input?: unknown }) => say(iss.input === undefined ? "required" : key);
  const { visible, normalized } = walk(def, raw);
  const shape: Record<string, z.ZodMiniType> = {};
  for (const f of visible) {
    const oneOf = () => z.enum(f.options!.map((o) => o.value) as [string, ...string[]], { error: bad("chooseOne") });
    let schema: z.ZodMiniType;
    switch (f.type) {
      case "email":
        schema = z.string({ error: bad("invalidEmail") }).check(z.regex(EMAIL, { error: () => say("invalidEmail") }));
        break;
      case "number": {
        const checks = [];
        if (f.min !== undefined) checks.push(z.minimum(f.min, { error: () => say("min", { min: f.min! }) }));
        if (f.max !== undefined) checks.push(z.maximum(f.max, { error: () => say("max", { max: f.max! }) }));
        schema = z.number({ error: bad("number") }).check(...checks);
        break;
      }
      case "single_choice":
        schema = oneOf();
        break;
      case "multiple_choice":
        schema = z.array(oneOf(), { error: bad("chooseOne") });
        break;
      case "yes_no":
        schema = z.boolean({ error: bad("chooseOne") });
        break;
      default: {
        const max = f.maxLength;
        schema = z.string({ error: bad("chooseOne") });
        if (max !== undefined) schema = (schema as z.ZodMiniString).check(z.refine((s) => [...s].length <= max, { error: () => say("maxLength", { max }) }));
      }
    }
    shape[f.id] = f.required ? schema : z.optional(schema);
  }
  const input = Object.fromEntries(visible.map((f) => [f.id, normalized.get(f.id)]));
  const r = z.safeParse(z.object(shape), input);
  if (r.success) {
    // Dropping undefined keeps empty optionals out of values.
    return { ok: true, values: Object.fromEntries(Object.entries(r.data).filter(([, v]) => v !== undefined)) as Values };
  }
  const errors: Record<string, string> = {};
  for (const i of r.error.issues) errors[String(i.path[0])] ??= i.message;
  return { ok: false, errors };
}
