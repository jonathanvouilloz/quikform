import type { FormDefinition } from "../definition/schema";
import { formatValue } from "../notify/telegram";
import { escapeHtml as e } from "../render/escape";
import type { StoredResponse } from "../store/db";

export type AdminLang = "en" | "fr";

const STRINGS = {
  en: {
    title: "Forms", login: "Sign in", password: "Password", wrong: "Wrong password.", tooMany: "Too many attempts. Try again in 15 minutes.",
    logout: "Sign out", projects: "Projects", form: "form", forms: "forms", answer: "answer", answers: "answers", last: "last answer", none: "No answers yet",
    noForms: "No forms yet.", public: "Public", private: "Private", notStarted: "Not started", complete: "Complete",
    inProgress: "In progress ({k} of {n})", noLinks: "No links yet", copy: "Copy", copied: "Copied", answered: "answered",
    waiting: "not yet", questions: "Questions", via: "via", back: "All projects", version: "version",
  },
  fr: {
    title: "Formulaires", login: "Se connecter", password: "Mot de passe", wrong: "Mot de passe incorrect.", tooMany: "Trop d’essais. Réessayez dans 15 minutes.",
    logout: "Se déconnecter", projects: "Projets", form: "formulaire", forms: "formulaires", answer: "réponse", answers: "réponses", last: "dernière réponse", none: "Aucune réponse",
    noForms: "Aucun formulaire.", public: "Public", private: "Privé", notStarted: "Pas commencé", complete: "Terminé",
    inProgress: "En cours ({k} sur {n})", noLinks: "Aucun lien", copy: "Copier", copied: "Copié", answered: "a répondu",
    waiting: "pas encore", questions: "Questions", via: "lien", back: "Tous les projets", version: "version",
  },
} as const;
type Key = keyof (typeof STRINGS)["en"];
const say = (lang: AdminLang, k: Key, vars: Record<string, number> = {}) =>
  STRINGS[lang][k].replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v]));

// French uses the singular for 0 and 1, English only for 1.
const count = (lang: AdminLang, n: number, one: "form" | "answer") =>
  `${n} ${say(lang, n === 1 || (lang === "fr" && n === 0) ? one : one === "form" ? "forms" : "answers")}`;

// Server time zone: set TZ in the service environment to show local times.
const when = (lang: AdminLang, d: Date) =>
  new Intl.DateTimeFormat(lang === "fr" ? "fr-CH" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(d);

function shell(lang: AdminLang, title: string, body: string, signedIn = true): string {
  const out = signedIn
    ? `<form method="post" action="/logout" class="qf-admin-out"><button type="submit" class="qf-admin-linkbtn">${e(say(lang, "logout"))}</button></form>`
    : "";
  return (
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="robots" content="noindex">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)}</title>` +
    `<link rel="stylesheet" href="/_qf/app.css"><script src="/_qf/admin.js" defer></script></head>` +
    `<body><main class="qf qf-admin">${out}${body}</main></body></html>`
  );
}

export function renderLogin(lang: AdminLang, error?: "wrong" | "tooMany"): string {
  const msg = error ? `<p class="qf-admin-error" role="alert">${e(say(lang, error))}</p>` : "";
  return shell(
    lang,
    say(lang, "login"),
    `<h1 class="qf-title">${e(say(lang, "title"))}</h1>${msg}` +
      `<form method="post" action="/login" class="qf-form"><div class="qf-field"><label class="qf-label" for="password">${e(say(lang, "password"))}</label>` +
      `<input type="password" id="password" name="password" autocomplete="current-password" required autofocus></div>` +
      `<div class="qf-actions"><button type="submit" class="qf-submit">${e(say(lang, "login"))}</button></div></form>`,
    false,
  );
}

export type ProjectSummary = { slug: string; name: string; forms: number; answers: number; last?: Date };

export function renderProjects(lang: AdminLang, projects: ProjectSummary[]): string {
  const rows = projects
    .map(
      (p) =>
        `<li class="qf-admin-row"><a class="qf-admin-name" href="/p/${e(p.slug)}">${e(p.name)}</a>` +
        `<span class="qf-admin-meta">${e(count(lang, p.forms, "form"))} · ${e(count(lang, p.answers, "answer"))}` +
        (p.last ? ` · ${e(say(lang, "last"))} ${e(when(lang, p.last))}` : "") +
        `</span></li>`,
    )
    .join("");
  return shell(lang, say(lang, "projects"), `<h1 class="qf-title">${e(say(lang, "projects"))}</h1><ul class="qf-admin-list">${rows}</ul>`);
}

export type LinkRow = { label: string; url: string; answered: boolean };
export type FormSummary = { def: FormDefinition; answers: number; url?: string; links: LinkRow[] };

function status(lang: AdminLang, f: FormSummary): string {
  if (f.def.access === "public") return f.answers ? count(lang, f.answers, "answer") : say(lang, "none");
  const n = f.links.length;
  const k = f.links.filter((l) => l.answered).length;
  return !n ? say(lang, "noLinks") : !k ? say(lang, "notStarted") : k < n ? say(lang, "inProgress", { k, n }) : say(lang, "complete");
}

const copyField = (lang: AdminLang, label: string, url: string) =>
  `<span class="qf-admin-copy"><input readonly aria-label="${e(label)}" value="${e(url)}">` +
  `<button type="button" class="qf-admin-linkbtn" data-copy data-done="${e(say(lang, "copied"))}">${e(say(lang, "copy"))}</button></span>`;

export function renderForms(lang: AdminLang, slug: string, name: string, forms: FormSummary[]): string {
  const items = forms
    .map((f) => {
      const links =
        f.def.access === "public"
          ? f.url ? copyField(lang, f.def.title, f.url) : ""
          : f.links
              .map((l) => `<li><span class="qf-admin-who">${e(l.label)} · ${e(say(lang, l.answered ? "answered" : "waiting"))}</span>${copyField(lang, l.label, l.url)}</li>`)
              .join("");
      return (
        `<li class="qf-admin-row"><a class="qf-admin-name" href="/p/${e(slug)}/f/${e(f.def.id)}">${e(f.def.title)}</a>` +
        `<span class="qf-admin-meta">${e(say(lang, f.def.access))} · ${e(status(lang, f))}</span>` +
        (f.def.access === "public" ? links : `<ul class="qf-admin-links">${links}</ul>`) +
        `</li>`
      );
    })
    .join("");
  return shell(
    lang,
    name,
    `<p><a href="/">${e(say(lang, "back"))}</a></p><h1 class="qf-title">${e(name)}</h1>` +
      (items ? `<ul class="qf-admin-list">${items}</ul>` : `<p class="qf-description">${e(say(lang, "noForms"))}</p>`),
  );
}

export function renderAnswers(lang: AdminLang, project: { slug: string; name: string }, def: FormDefinition, responses: StoredResponse[]): string {
  const fields = def.steps.flatMap((s) => s.fields);
  const body = responses.length
    ? responses
        .map((r) => {
          const known = fields.filter((f) => f.id in r.values);
          // Answers given to an older version may hold fields that no longer exist: shown by id.
          const extra = Object.keys(r.values).filter((id) => !fields.some((f) => f.id === id));
          const rows =
            known.map((f) => `<dt>${e(f.label)}</dt><dd>${e(formatValue(def, f, r.values[f.id]!))}</dd>`).join("") +
            extra.map((id) => `<dt>${e(id)}</dt><dd>${e(String(r.values[id]))}</dd>`).join("");
          const who = r.link ? ` · ${e(say(lang, "via"))} ${e(r.link)}` : "";
          return `<article class="qf-admin-answer"><h2 class="qf-step-title">${e(when(lang, r.createdAt))}${who}</h2><dl>${rows}</dl></article>`;
        })
        .join("")
    : `<p class="qf-description">${e(say(lang, "none"))}</p><h2 class="qf-step-title">${e(say(lang, "questions"))}</h2>` +
      def.steps
        .map((s) => (s.title ? `<h3>${e(s.title)}</h3>` : "") + `<ol>${s.fields.map((f) => `<li>${e(f.label)}</li>`).join("")}</ol>`)
        .join("");
  return shell(
    lang,
    def.title,
    `<p><a href="/p/${e(project.slug)}">${e(project.name)}</a></p><h1 class="qf-title">${e(def.title)}</h1>` +
      `<p class="qf-admin-meta">${e(say(lang, def.access))} · ${e(count(lang, responses.length, "answer"))} · ${e(say(lang, "version"))} ${def.version}</p>${body}`,
  );
}

// Served as /_qf/admin.js (the CSP allows only same-origin scripts, no inline ones).
export const ADMIN_JS = `// Copy buttons of the read-only admin: copy the URL in the field just before the button.
for (const b of document.querySelectorAll("[data-copy]")) {
  b.addEventListener("click", async () => {
    const input = b.previousElementSibling;
    try {
      await navigator.clipboard.writeText(input.value);
      b.textContent = b.dataset.done;
    } catch {
      input.select();
    }
  });
}
`;
