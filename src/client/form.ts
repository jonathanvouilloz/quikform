// Progressive enhancement of the server-rendered form: one step at a time, live validation, showIf,
// keyboard shortcuts and a local draft. The form still submits as a normal POST; the server validates again.
import { HONEYPOT, MIN_AGE_MS, type FormDefinition } from "../definition/schema";
import { validateResponse, visibleFields } from "../definition/response";
import { t, type StringKey } from "../i18n/strings";

type Raw = Record<string, string | string[]>;
export type Draft = { step: number; values: Raw };

// Same shape the server builds from the POST body: a repeated name becomes an array.
export function toRaw(fd: FormData): Raw {
  const raw: Raw = {};
  for (const k of new Set(fd.keys())) {
    const all = fd.getAll(k).filter((v): v is string => typeof v === "string");
    if (all.length) raw[k] = all.length > 1 ? all : all[0]!;
  }
  return raw;
}

// A private link's token is part of the key: two people's links on one browser never share a draft.
export const draftPrefix = (host: string, formId: string, token?: string) => `qf:${host}:${formId}:${token ? `${token}:` : ""}`;
export const draftKey = (host: string, def: FormDefinition, token?: string) => draftPrefix(host, def.id, token) + def.version;

// Time still to wait so the answer reaches the server after MIN_AGE_MS; the page loads after the server stamped it.
export const submitDelay = (loadedAt: number, now: number) => Math.max(0, MIN_AGE_MS - (now - loadedAt));

export const draftValues = (raw: Raw): Raw =>
  Object.fromEntries(Object.entries(raw).filter(([k]) => k !== HONEYPOT && k !== "_sid" && k !== "_t" && k !== "_k"));

export function stepErrors(def: FormDefinition, raw: Raw, step: number): Record<string, string> {
  const r = validateResponse(def, raw);
  if (r.ok) return {};
  const ids = new Set(def.steps[step]!.fields.map((f) => f.id));
  return Object.fromEntries(Object.entries(r.errors).filter(([id]) => ids.has(id)));
}

// Steps with at least one visible field; a step emptied by showIf is skipped and not counted.
export function activeSteps(def: FormDefinition, raw: Raw): number[] {
  const visible = new Set(visibleFields(def, raw).map((f) => f.id));
  return def.steps.flatMap((s, i) => (s.fields.some((f) => visible.has(f.id)) ? [i] : []));
}

// Storage can be blocked (private mode, policy) or full: the form then works without a draft.
export function readDraft(key: string): Draft | undefined {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? "null");
    return Number.isInteger(d?.step) && d.values && typeof d.values === "object" ? d : undefined;
  } catch {
    return undefined;
  }
}
export function saveDraft(key: string, draft: Draft): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
// Every version of one form's draft: called on the thanks page, once the server has the answer.
export function clearDrafts(prefix: string): boolean {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k) => k?.startsWith(prefix));
    for (const k of keys) localStorage.removeItem(k!);
    return true;
  } catch {
    return false;
  }
}

type Control = HTMLInputElement | HTMLTextAreaElement;

function init(form: HTMLFormElement, def: FormDefinition) {
  const loadedAt = Date.now();
  const say = (k: StringKey, vars?: Record<string, number>) => t(def.lang, def.address, k, vars);
  const ids = def.steps.flatMap((s) => s.fields.map((f) => f.id));
  const sections = [...form.querySelectorAll<HTMLElement>("[data-step]")];
  const actions = form.querySelector<HTMLElement>("[data-actions]")!;
  const submit = actions.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const progress = document.querySelector<HTMLProgressElement>("[data-progress]");
  const key = draftKey(location.host, def, form.querySelector<HTMLInputElement>("input[name=_k]")?.value);
  const fieldEl = (id: string) => form.querySelector<HTMLElement>(`[data-field="${id}"]`)!;
  const controls = (root: ParentNode) => [...root.querySelectorAll<Control>("input, textarea")];
  const control = (el: Element) => el.querySelector<Control>("input:checked") ?? el.querySelector<Control>("input, textarea");
  const shown = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>("[data-field]")].filter((el) => !el.hidden);
  const stepOf = (id: string) => def.steps.findIndex((s) => s.fields.some((f) => f.id === id));
  const raw = () => toRaw(new FormData(form));
  const touched = new Set<string>();
  const stepMode = sections.length > 1;
  let current = 0;
  let sent = false;

  function showError(id: string, msg?: string) {
    const el = fieldEl(id);
    const errId = `${id}:error`;
    let p = document.getElementById(errId);
    if (!msg) p?.remove();
    else {
      if (!p) {
        p = document.createElement("p");
        p.id = errId;
        p.className = "qf-error";
        (document.getElementById(`${id}:help`) ?? el.querySelector(".qf-label")!).after(p);
      }
      p.textContent = msg;
    }
    const described = el.tagName === "FIELDSET" ? el : control(el)!;
    const refs = (described.getAttribute("aria-describedby") ?? "").split(" ").filter((r) => r && r !== errId);
    if (msg) refs.push(errId);
    if (refs.length) described.setAttribute("aria-describedby", refs.join(" "));
    else described.removeAttribute("aria-describedby");
    for (const c of controls(el)) msg ? c.setAttribute("aria-invalid", "true") : c.removeAttribute("aria-invalid");
  }

  // Shows the given errors, focuses the first one (on its step) and says whether there was none.
  function report(errors: Record<string, string>, list: string[]): boolean {
    for (const id of list) {
      touched.add(id);
      showError(id, errors[id]);
    }
    const first = list.find((id) => errors[id]);
    if (first === undefined) return true;
    if (stepMode) go(stepOf(first), false);
    control(fieldEl(first))?.focus();
    return false;
  }

  // Hidden fields are disabled so they are neither validated nor submitted, as on the server.
  // Everything is enabled first so a field revealed now counts for the fields that depend on it.
  function sync(): Raw {
    for (const c of controls(form)) if (c.closest("[data-field]")) c.disabled = false;
    const visible = new Set(visibleFields(def, raw()).map((f) => f.id));
    for (const id of ids) {
      const el = fieldEl(id);
      const show = visible.has(id);
      if (el.hidden === show) {
        el.hidden = !show;
        if (show) el.classList.add("qf-in");
        else showError(id);
      }
      for (const c of controls(el)) c.disabled = !show;
    }
    return raw();
  }

  const save = () => sent || saveDraft(key, { step: current, values: draftValues(raw()) });

  const status = document.createElement("p");
  status.className = "qf-stepof";
  status.setAttribute("aria-live", "polite");
  // Next is a copy of the submit button (same look and arrow); Back comes after it in the tab order.
  const next = submit.cloneNode(true) as HTMLButtonElement;
  next.type = "button";
  next.firstChild!.textContent = say("next");
  const back = document.createElement("button");
  back.type = "button";
  back.className = "qf-back";
  back.textContent = say("back");

  function go(step: number, focus = true) {
    const steps = activeSteps(def, raw());
    if (!steps.includes(step)) step = steps.find((i) => i > step) ?? steps[steps.length - 1]!;
    current = step;
    const pos = steps.indexOf(step);
    sections.forEach((s, i) => (s.hidden = i !== step));
    next.hidden = pos === steps.length - 1;
    submit.hidden = !next.hidden;
    back.hidden = pos === 0;
    const text = say("stepOf", { current: pos + 1, total: steps.length });
    status.textContent = text;
    if (progress) {
      progress.max = steps.length;
      progress.value = pos + 1;
      progress.setAttribute("aria-label", text);
    }
    if (focus) {
      sections[step]!.classList.add("qf-in");
      const first = shown(sections[step]!)[0];
      if (first) control(first)?.focus();
    }
  }

  const draft = readDraft(key);
  const serverErrors = form.querySelector("[aria-invalid]");
  // The server's re-rendered values are newer than any draft.
  if (draft && !serverErrors) {
    for (const c of controls(form)) {
      const v = draft.values[c.name];
      if (v === undefined || !c.closest("[data-field]")) continue;
      const list = [v].flat().map(String);
      if (c.type === "radio" || c.type === "checkbox") (c as HTMLInputElement).checked = list.includes(c.value);
      else c.value = list[0] ?? "";
    }
    const note = document.createElement("p");
    note.className = "qf-draft";
    note.setAttribute("role", "status");
    note.textContent = say("draftRestored");
    form.prepend(note);
  }
  sync();

  if (stepMode) {
    actions.prepend(next);
    // The counter sits with the buttons: above the step title it would read as an eyebrow.
    actions.append(back, status);
    progress?.removeAttribute("hidden");
    const start = serverErrors ? Number(serverErrors.closest<HTMLElement>("[data-step]")!.dataset.step) : (draft?.step ?? 0);
    go(start, false);
    next.addEventListener("click", () => {
      if (!report(stepErrors(def, sync(), current), def.steps[current]!.fields.map((f) => f.id))) return;
      const steps = activeSteps(def, raw());
      go(steps[steps.indexOf(current) + 1]!);
      save();
    });
    back.addEventListener("click", () => {
      const steps = activeSteps(def, raw());
      go(steps[steps.indexOf(current) - 1]!);
      save();
    });
    // Error summary links point into steps that may be hidden.
    document.getElementById("qf-summary")?.addEventListener("click", (e) => {
      const a = (e.target as Element).closest("a");
      const target = a && document.getElementById(a.getAttribute("href")!.slice(1));
      const field = target?.closest<HTMLElement>("[data-field]");
      if (!target || !field) return;
      e.preventDefault();
      go(stepOf(field.dataset.field!), false);
      target.focus();
    });
  }

  form.addEventListener("input", () => {
    const r = validateResponse(def, sync());
    for (const id of touched) showError(id, r.ok ? undefined : r.errors[id]);
    save();
  });

  // An error shown on blur moves the layout. Shown while the pointer is still down, it would slide the
  // clicked element away before mouseup and swallow the click, so it waits until after the click.
  let pressed = false;
  const blurred = new Set<string>();
  const showBlurred = () => {
    if (pressed) return;
    const r = validateResponse(def, raw());
    for (const id of blurred) showError(id, r.ok ? undefined : r.errors[id]);
    blurred.clear();
  };
  form.addEventListener("pointerdown", () => (pressed = true));
  for (const type of ["pointerup", "pointercancel"]) {
    addEventListener(type, () => {
      pressed = false;
      setTimeout(showBlurred);
    });
  }
  form.addEventListener("focusout", (e) => {
    const el = (e.target as Element).closest<HTMLElement>("[data-field]");
    // Moving between the options of one group is not leaving the field.
    if (!el || el.contains(e.relatedTarget as Node | null)) return;
    touched.add(el.dataset.field!);
    blurred.add(el.dataset.field!);
    showBlurred();
  });

  form.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    const el = target.closest<HTMLElement>("[data-field]");
    if (!el || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Enter" && target.tagName !== "TEXTAREA") {
      e.preventDefault();
      const fields = shown(stepMode ? sections[current]! : form);
      const after = fields[fields.indexOf(el) + 1];
      if (after) control(after)?.focus();
      else if (stepMode && !next.hidden) next.click();
      else form.requestSubmit(submit);
    } else if (el.tagName === "FIELDSET" && /^[a-z]$/i.test(e.key)) {
      const option = controls(el)[e.key.toUpperCase().charCodeAt(0) - 65];
      if (!option) return;
      e.preventDefault();
      option.click();
      option.focus();
    }
  });

  form.addEventListener("submit", (e) => {
    if (sent) return e.preventDefault();
    const r = validateResponse(def, sync());
    if (!r.ok) {
      e.preventDefault();
      report(r.errors, ids);
      return;
    }
    sent = true;
    submit.disabled = true;
    submit.firstChild!.textContent = say("sending");
    // Sent too early, the answer would be dropped as spam: hold it. form.submit() fires no submit event.
    const wait = submitDelay(loadedAt, Date.now());
    if (wait > 0) {
      e.preventDefault();
      setTimeout(() => form.submit(), wait);
    }
  });
}

if (typeof document !== "undefined") {
  const form = document.querySelector<HTMLFormElement>("form.qf-form");
  const def = document.getElementById("qf-def")?.textContent;
  if (form && def) init(form, JSON.parse(def));
  const thanks = document.querySelector<HTMLElement>("[data-qf-thanks]");
  if (thanks) clearDrafts(draftPrefix(location.host, thanks.dataset.qfThanks!, new URLSearchParams(location.search).get("k") ?? undefined));
}
