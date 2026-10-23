import * as z from "zod/mini";

const ID = /^[a-z][a-z0-9_-]{0,47}$/;
// Name of the anti-spam input on the form page; a field with this id would look like a filled honeypot.
export const HONEYPOT = "website";
// The server ignores answers sent sooner than this after the page was served; the client waits it out.
export const MIN_AGE_MS = 3000;

// A field id is a key of plain objects in the page and the validator; inherited names would resolve to Object.prototype.
const RESERVED_IDS = [HONEYPOT, ...Object.getOwnPropertyNames(Object.prototype)];

const CHOICE_TYPES = ["single_choice", "multiple_choice"];

const FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "number",
  "single_choice",
  "multiple_choice",
  "yes_no",
] as const;

const Option = z.strictObject({ value: z.string().check(z.minLength(1)), label: z.string().check(z.minLength(1)) });

const ShowIf = z.strictObject({
  field: z.string().check(z.regex(ID)),
  equals: z.optional(z.union([z.string(), z.boolean()])),
  in: z.optional(z.array(z.string())),
});

const Field = z
  .strictObject({
    id: z.string().check(z.regex(ID), z.refine((id) => !RESERVED_IDS.includes(id), { error: (iss) => `"${iss.input}" is reserved` })),
    type: z.enum(FIELD_TYPES),
    label: z.string().check(z.minLength(1)),
    help: z.optional(z.string()),
    placeholder: z.optional(z.string()),
    required: z._default(z.boolean(), false),
    options: z.optional(z.array(Option)),
    min: z.optional(z.number()),
    max: z.optional(z.number()),
    maxLength: z.optional(z.int().check(z.positive())),
    showIf: z.optional(ShowIf),
  })
  .check((ctx) => {
    const f = ctx.value;
    const isChoice = CHOICE_TYPES.includes(f.type);
    if (isChoice && (f.options?.length ?? 0) < 2) {
      ctx.issues.push({ code: "custom", message: "choice fields need at least 2 options", input: f.options, path: ["options"] });
    } else if (!isChoice && f.options) {
      ctx.issues.push({ code: "custom", message: "options are only allowed on choice fields", input: f.options, path: ["options"] });
    }
    if (f.showIf && f.showIf.equals === undefined && f.showIf.in === undefined) {
      ctx.issues.push({ code: "custom", message: "showIf needs equals or in", input: f.showIf, path: ["showIf"] });
    }
  });

const Step = z.strictObject({
  title: z.optional(z.string()),
  fields: z.array(Field).check(z.minLength(1)),
});

const FormDefinitionSchema = z
  .strictObject({
    id: z.string().check(z.regex(ID)),
    version: z._default(z.int().check(z.positive()), 1),
    lang: z.enum(["fr", "en", "de", "th"]),
    address: z._default(z.enum(["formal", "informal"]), "formal"),
    title: z.string().check(z.minLength(1)),
    description: z.optional(z.string()),
    privacy: z.string().check(z.minLength(1)),
    submitLabel: z.optional(z.string()),
    thankYou: z.strictObject({ title: z.string(), body: z.string() }),
    access: z.literal("public"),
    notify: z.strictObject({ telegram: z.boolean() }),
    steps: z.array(Step).check(z.minLength(1)),
  })
  .check((ctx) => {
    const seen = new Set<string>();
    ctx.value.steps.forEach((step, s) =>
      step.fields.forEach((field, f) => {
        const at = ["steps", s, "fields", f];
        if (seen.has(field.id)) {
          ctx.issues.push({ code: "custom", message: `duplicate field id "${field.id}"`, input: field.id, path: [...at, "id"] });
        }
        const target = field.showIf?.field;
        if (target !== undefined && !seen.has(target)) {
          ctx.issues.push({
            code: "custom",
            message: `showIf refers to "${target}", which is not an earlier field`,
            input: field.showIf,
            path: [...at, "showIf"],
          });
        }
        seen.add(field.id);
      }),
    );
  });

export type FieldType = (typeof FIELD_TYPES)[number];
export type Field = z.output<typeof Field>;
export type FormDefinition = z.output<typeof FormDefinitionSchema>;

export function parseDefinition(
  input: unknown,
): { ok: true; value: FormDefinition } | { ok: false; errors: string[] } {
  const r = z.safeParse(FormDefinitionSchema, input);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map(formatIssue) };
}

/** One readable line per issue: zod/mini says "Invalid input" for unknown keys and leaves a root path empty. */
export const formatIssue = (i: z.core.$ZodIssue) =>
  `${i.path.join(".") || "(root)"}: ${i.code === "unrecognized_keys" ? `unrecognized keys ${i.keys.join(", ")}` : i.message}`;
