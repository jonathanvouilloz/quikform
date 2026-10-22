import type { Field } from "../definition/schema";
import { t, type Address, type Lang } from "../i18n/strings";
import { escapeHtml as e } from "./escape";

type Ctx = { value?: unknown; error?: string; lang: Lang; address: Address };

// Element ids use ":" because field ids cannot contain it, so "<id>:help" never collides with another field.
export const optionId = (fieldId: string, i: number) => `${fieldId}:${i}`;

function selected(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => (typeof x === "boolean" ? (x ? "yes" : "no") : String(x)));
}

export function renderField(field: Field, ctx: Ctx): string {
  const say = (key: Parameters<typeof t>[2], vars?: Record<string, number>) => t(ctx.lang, ctx.address, key, vars);
  const id = field.id;
  const helpText = [field.help, field.maxLength === undefined ? undefined : say("maxLength", { max: field.maxLength })]
    .filter(Boolean)
    .join(" ");
  const help = helpText ? `<p id="${id}:help" class="qf-help">${e(helpText)}</p>` : "";
  const error = ctx.error ? `<p id="${id}:error" class="qf-error">${e(ctx.error)}</p>` : "";
  const describedby = [help && `${id}:help`, error && `${id}:error`].filter(Boolean).join(" ");
  const aria = (describedby ? ` aria-describedby="${describedby}"` : "") + (error ? ` aria-invalid="true"` : "");
  const title = e(field.label) + (field.required ? "" : `<span class="qf-optional"> (${e(say("optional"))})</span>`);
  const req = field.required ? " required" : "";

  if (field.type === "single_choice" || field.type === "multiple_choice" || field.type === "yes_no") {
    const options =
      field.type === "yes_no" ? [{ value: "yes", label: say("yes") }, { value: "no", label: say("no") }] : field.options!;
    const type = field.type === "multiple_choice" ? "checkbox" : "radio";
    const chosen = selected(ctx.value);
    const items = options
      .map((o, i) => {
        const key = i < 26 ? String.fromCharCode(65 + i) : "";
        const oid = optionId(id, i);
        return (
          `<label class="qf-option" for="${oid}"><input type="${type}" id="${oid}" name="${id}" value="${e(o.value)}"` +
          `${chosen.includes(o.value) ? " checked" : ""}${type === "radio" ? req : ""}${error ? ` aria-invalid="true"` : ""}>` +
          (key ? `<span class="qf-key" data-key="${key}" aria-hidden="true">${key}</span>` : "") +
          `<span class="qf-option-label">${e(o.label)}</span></label>`
        );
      })
      .join("");
    return (
      `<fieldset class="qf-field" data-field="${id}"${describedby ? ` aria-describedby="${describedby}"` : ""}>` +
      `<legend class="qf-label">${title}</legend>${help}${error}<div class="qf-options">${items}</div></fieldset>`
    );
  }

  const value = selected(ctx.value)[0] ?? "";
  const common =
    `id="${id}" name="${id}"${field.placeholder ? ` placeholder="${e(field.placeholder)}"` : ""}` +
    `${field.maxLength ? ` maxlength="${field.maxLength}"` : ""}${req}${aria}`;
  const control =
    field.type === "long_text"
      ? `<textarea ${common} rows="4">${e(value)}</textarea>`
      : `<input ${
          field.type === "email"
            ? `type="email" inputmode="email" autocomplete="email"`
            : field.type === "number"
              ? `type="text" inputmode="decimal"`
              : `type="text"`
        } ${common} value="${e(value)}">`;
  return `<div class="qf-field" data-field="${id}"><label for="${id}" class="qf-label">${title}</label>${help}${error}${control}</div>`;
}
