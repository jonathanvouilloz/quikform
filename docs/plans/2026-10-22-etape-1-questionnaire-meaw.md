# Étape 1 — Envoyer le questionnaire de Meaw : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un formulaire en étapes, décrit en JSON, servi sur `formulaire.wildcatmuaythai.com`, validé par Zod, enregistré dans la base SQLite du projet, avec une alerte Telegram à chaque envoi.

**Architecture:** un processus Bun + Hono choisit le projet d'après le domaine, rend la page en HTML côté serveur à partir de composants de champs, et valide l'envoi avec un schéma Zod tiré de la définition. Un script client (le même schéma, compilé pour le navigateur) ajoute les étapes, la validation au fil de la saisie, les conditions et le brouillon. La CLI est la seule porte d'entrée des agents.

**Tech Stack:** Bun 1.4.3, Hono 4.13, Zod 4.6 (`zod/mini` côté serveur et navigateur), `bun:sqlite`, `bun test`, `bun build --compile`.

**Spec:** `docs/project/prd.md`, `docs/project/architecture.md`, `PRODUCT.md`, `design/references/refs.md`, `docs/project/decisions.md`.

## Global Constraints

- Moins de 100 Mo de RAM au repos pour `quikform serve` ; aucune dépendance d'exécution hors `hono` et `zod`.
- Le formulaire fonctionne sans JavaScript (envoi classique, erreurs rendues par le serveur).
- Label toujours visible ; le texte d'exemple ne remplace jamais un label.
- Tout texte venant d'une définition ou d'un répondant est échappé avant d'entrer dans le HTML.
- Aucun traceur, aucune ressource externe chargée par la page (polices système, script et CSS servis par quikform).
- Code, noms et messages en anglais ; textes d'interface en `fr`, `en`, `de`, `th` ; `fr`/`de` en vouvoiement par défaut (`address: "formal"`), tutoiement si `address: "informal"`.
- Conservation par défaut : 12 mois (`retentionMonths: 12`).
- Cibles tactiles d'au moins 44 px ; WCAG 2.2 AA.
- Données d'un projet uniquement dans `$QUIKFORM_HOME/projects/<slug>/`.

## Review Focus

1. Un champ obligatoire masqué par une condition (`showIf`) ne doit jamais bloquer l'envoi ; sa valeur est ignorée. → test Tâche 2.
2. Un texte de définition ou une réponse contenant `<script>` ou `"` s'affiche tel quel, sans s'exécuter. → test Tâche 3.
3. Un envoi sans JavaScript avec des erreurs réaffiche le formulaire avec les valeurs saisies, un résumé d'erreurs en tête et chaque erreur reliée à son champ. → test Tâche 6.
4. Telegram en panne : la réponse est enregistrée, l'alerte est retentée plus tard. → test Tâche 5.
5. Double appui sur « Envoyer » : une seule réponse en base (jeton d'envoi unique). → test Tâche 4.

---

## Structure des fichiers

```
src/definition/schema.ts     schéma Zod d'une définition + type FormDefinition
src/definition/response.ts   schéma de réponse tiré d'une définition (serveur et navigateur)
src/i18n/strings.ts          textes d'interface fr/en/de/th, formel/informel
src/render/escape.ts         échappement HTML
src/render/fields.ts         un composant par type de champ
src/render/page.ts           page complète, étapes, résumé d'erreurs, page de remerciement
src/render/styles.css        jetons et styles (marque blanche)
src/client/form.ts           amélioration progressive
src/store/db.ts              base SQLite par projet
src/projects/registry.ts     chargement des projets et des formulaires
src/notify/telegram.ts       alerte, file de renvoi
src/server/app.ts            routes Hono, anti-spam
src/cli/main.ts              CLI : serve, check, form put, responses
deploy/quikform.service      service systemd utilisateur
tests/…                      un fichier de test par module
```

---

### Task 1: Format de définition et vérification

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore` (compléter), `src/definition/schema.ts`
- Test: `tests/definition/schema.test.ts`, `tests/fixtures/minimal.json`, `tests/fixtures/steps.json`

**Interfaces:**
- Produces:
  - `type FieldType = "short_text" | "long_text" | "email" | "number" | "single_choice" | "multiple_choice" | "yes_no"`
  - `type Field = { id: string; type: FieldType; label: string; help?: string; placeholder?: string; required: boolean; options?: { value: string; label: string }[]; min?: number; max?: number; maxLength?: number; showIf?: { field: string; equals?: string | boolean; in?: string[] } }`
  - `type FormDefinition = { id: string; version: number; lang: "fr" | "en" | "de" | "th"; address: "formal" | "informal"; title: string; description?: string; privacy: string; submitLabel?: string; thankYou: { title: string; body: string }; access: "public"; notify: { telegram: boolean }; steps: { title?: string; fields: Field[] }[] }`
  - `parseDefinition(input: unknown): { ok: true; value: FormDefinition } | { ok: false; errors: string[] }`

- [ ] **Step 1: Initialiser le projet** — `bun init` minimal, `package.json` avec `"name": "quikform"`, `"license": "MIT"`, dépendances `hono@4.13.13`, `zod@4.6.7`, script `"test": "bun test"`. `tsconfig.json` strict.
- [ ] **Step 2: Écrire les tests qui échouent**

```ts
test("accepts a minimal one-step form", () => {
  const r = parseDefinition(minimal);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.value.steps[0].fields[0].required).toBe(false); // défaut
});
test("rejects duplicate field ids across steps", () => { /* r.ok false, errors mention the id */ });
test("rejects choice fields without at least 2 options", () => {});
test("rejects showIf pointing to an unknown or later field", () => {});
test("rejects unknown keys (strict)", () => {});
test("defaults: address formal, version 1", () => {});
test("error messages carry the JSON path, e.g. steps.0.fields.2.options", () => {});
```

- [ ] **Step 3: Lancer** `bun test tests/definition/schema.test.ts` — attendu : FAIL (`parseDefinition` absent).
- [ ] **Step 4: Implémenter `parseDefinition`** avec `zod/mini` : objets stricts ; `id` de champ et de formulaire en `^[a-z][a-z0-9_-]{0,47}$` ; contrôles inter-champs (unicité, `showIf` vers un champ antérieur) dans un `refine` final ; erreurs à plat `"<chemin>: <message>"`.
- [ ] **Step 5: Lancer les tests** — attendu : PASS.
- [ ] **Step 6: Commit** `feat: form definition schema and parser`

### Task 2: Schéma de réponse et textes d'interface

**Files:**
- Create: `src/definition/response.ts`, `src/i18n/strings.ts`
- Test: `tests/definition/response.test.ts`, `tests/i18n/strings.test.ts`

**Interfaces:**
- Consumes: `FormDefinition`, `Field` (Task 1).
- Produces:
  - `type Lang = FormDefinition["lang"]` ; `type Address = FormDefinition["address"]`
  - `type Values = Record<string, string | string[] | number | boolean>`
  - `visibleFields(def: FormDefinition, raw: Record<string, unknown>): Field[]`
  - `validateResponse(def: FormDefinition, raw: Record<string, unknown>, lang?: string): { ok: true; values: Values } | { ok: false; errors: Record<string, string> }` — `raw` est soit un objet issu de `FormData` (chaînes, tableaux pour les choix multiples), soit un objet du navigateur.
  - `t(lang: Lang, address: "formal" | "informal", key: StringKey, vars?: Record<string, string | number>): string` avec `StringKey` = `"required" | "invalidEmail" | "number" | "min" | "max" | "maxLength" | "chooseOne" | "next" | "back" | "submit" | "stepOf" | "errorSummary" | "draftRestored" | "yes" | "no" | "optional" | "sending" | "networkError"`.

- [ ] **Step 1: Tests qui échouent**

```ts
test("required empty field -> errors.name === t('en','formal','required')", () => {});
test("email is trimmed and validated", () => {});
test("number field coerces '12' to 12 and checks min/max", () => {});
test("single_choice rejects a value not in options", () => {});
test("multiple_choice accepts string or string[] and returns string[]", () => {});
test("yes_no maps 'yes'/'no' to true/false", () => {});
test("hidden required field (showIf false) does not block and is dropped from values", () => {}); // Review Focus 1
test("Thai text and emoji are kept intact", () => {});
test("fr formal: required -> 'Ce champ est requis.'; invalidEmail formal -> 'Vérifiez votre adresse email.', informal -> 'Vérifie ton adresse email.'", () => {});
test("every StringKey exists in fr, en, de, th", () => {});
```

- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter.** `validateResponse` construit un `z.object` à partir des seuls `visibleFields` ; messages via `t`. Les textes d'interface sont courts, sans point d'exclamation, sans formule creuse ; pour `th`, pas de forme formelle/informelle distincte.
- [ ] **Step 4: Lancer** — PASS.
- [ ] **Step 5: Commit** `feat: response validation and UI strings`

### Task 3: Composants de champs et page (sans JavaScript)

Avant d'écrire le CSS : lire `~/.claude/plugins/cache/impeccable/impeccable/4.7.0/skills/impeccable/reference/craft-floor.md` et `design/references/refs.md`. Direction épinglée (Tally pour la page, Typeform pour la barre de progression et le bouton collé en bas sur téléphone) ; mode Operate.

**Files:**
- Create: `src/render/escape.ts`, `src/render/fields.ts`, `src/render/page.ts`, `src/render/styles.css`
- Test: `tests/render/fields.test.ts`, `tests/render/page.test.ts`

**Interfaces:**
- Consumes: `FormDefinition`, `Field`, `Values`, `t`, `visibleFields` (Tasks 1–2).
- Produces:
  - `escapeHtml(s: string): string`
  - `renderField(field: Field, ctx: { value?: unknown; error?: string; lang: Lang; address: Address }): string`
  - `type Brand = { name: string; logoUrl?: string; accent: string }`
  - `renderFormPage(input: { def: FormDefinition; brand: Brand; values?: Record<string, unknown>; errors?: Record<string, string>; submissionId: string; timestamp: string }): string`
  - `renderThankYouPage(def: FormDefinition, brand: Brand): string`
  - `renderNotFoundPage(): string`

- [ ] **Step 1: Tests qui échouent**

```ts
test("every field has a visible <label for=id> before its control", () => {});
test("placeholder never replaces the label", () => {});
test("email -> type=email inputmode=email autocomplete=email; number -> inputmode=decimal", () => {});
test("choices render as <fieldset><legend> with radio/checkbox, letter keys A, B, C", () => {});
test("error -> aria-invalid=true and aria-describedby pointing to the error id", () => {});
test("'<script>alert(1)</script>' in label and in value renders escaped", () => {}); // Review Focus 2
test("one step -> single page, no progress bar; several steps -> all steps rendered as <section data-step> (no-JS fallback)", () => {});
test("page includes honeypot input name=website (hidden from users and AT), hidden _sid and _t", () => {});
test("page has no external URL in src/href except brand.logoUrl", () => {});
test("brand.accent is applied as --qf-accent and only accepts #rgb/#rrggbb", () => {});
test("errors -> summary at top with links to each field", () => {}); // Review Focus 3 (rendu)
```

- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter le rendu** : HTML sémantique, `<form method="post" novalidate>` ; police système ; colonne d'environ 680 px ; label en gras au-dessus du champ, aide sous le label ; pastilles de choix bordées avec lettre ; bouton d'envoi plein, couleur `--qf-accent`, pleine largeur et collé en bas sur téléphone (< 640 px) ; mention de confidentialité sous le bouton ; logo en tête s'il existe. Les couleurs dérivées de l'accent (survol, focus) vérifient un contraste AA, avec repli sur le noir quand l'accent est trop clair.
- [ ] **Step 4: Lancer** — PASS.
- [ ] **Step 5: Commit** `feat: field components and server-rendered page`

### Task 4: Base SQLite par projet et registre des projets

**Files:**
- Create: `src/store/db.ts`, `src/projects/registry.ts`
- Test: `tests/store/db.test.ts`, `tests/projects/registry.test.ts`

**Interfaces:**
- Consumes: `parseDefinition`, `FormDefinition` (Task 1).
- Produces:
  - `openProjectDb(path: string): ProjectDb`, avec `ProjectDb` = `{ insertResponse(r: { submissionId: string; formId: string; formVersion: number; values: Values; createdAt?: Date }): { inserted: boolean; id: number }; listResponses(q: { formId?: string; limit?: number }): StoredResponse[]; purgeOlderThan(date: Date): number; outbox: { enqueue(responseId: number): void; due(now: Date): OutboxItem[]; markSent(id: number): void; markFailed(id: number, nextAt: Date): void } }`
  - `type StoredResponse = { id: number; submissionId: string; formId: string; formVersion: number; values: Values; createdAt: Date }` ; `type OutboxItem = { id: number; responseId: number; attempts: number }`
  - `type Project = { slug: string; dir: string; domains: string[]; brand: Brand; retentionMonths: number; telegram?: { chatId: string; threadId?: number; botToken: string }; forms: Map<string, FormDefinition>; db: ProjectDb; loadErrors: string[] }`
  - `loadProjects(home: string): Project[]` ; `resolveProject(projects: Project[], host: string): Project | undefined`

Disposition sur disque : `$QUIKFORM_HOME/projects/<slug>/project.json` (`domains`, `brand`, `retentionMonths`, `telegram.chatId`, `telegram.threadId`), `.env` (`TELEGRAM_BOT_TOKEN`), `forms/<id>.json`, `data.sqlite`.

- [ ] **Step 1: Tests qui échouent**

```ts
test("same submissionId twice -> second insert returns inserted:false, one row", () => {}); // Review Focus 5
test("values JSON round-trips Thai text", () => {});
test("purgeOlderThan deletes only older rows and returns the count", () => {});
test("WAL mode on, schema created once (idempotent open)", () => {});
test("an invalid form file is skipped, listed in loadErrors, other forms still load", () => {});
test("resolveProject matches host case-insensitively, ignores port", () => {});
test("token is read from the project's .env, never from project.json", () => {});
```

- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** avec `bun:sqlite` : tables `responses(id, submission_id UNIQUE, form_id, form_version, values_json, created_at)` et `telegram_outbox(id, response_id, attempts, next_at, sent_at)`.
- [ ] **Step 4: Lancer** — PASS.
- [ ] **Step 5: Commit** `feat: per-project sqlite store and project registry`

### Task 5: Alerte Telegram avec file de renvoi

**Files:**
- Create: `src/notify/telegram.ts`
- Test: `tests/notify/telegram.test.ts`

**Interfaces:**
- Consumes: `Project`, `ProjectDb.outbox`, `FormDefinition`, `StoredResponse` (Task 4).
- Produces:
  - `formatAlert(def: FormDefinition, values: Values): string` — titre du formulaire, puis une ligne `label : valeur` par champ visible, texte brut, coupé à 3 500 caractères.
  - `flushOutbox(project: Project, now: Date, send?: SendFn): Promise<{ sent: number; failed: number }>` avec `SendFn = (token: string, chatId: string, text: string, threadId?: number) => Promise<void>`
  - `startOutboxLoop(projects: Project[], intervalMs = 30_000): () => void`

- [ ] **Step 1: Tests qui échouent**

```ts
test("formatAlert lists label: value in field order, multiple choices joined by ', '", () => {});
test("send throws -> item stays, attempts+1, next_at backs off (1, 5, 30 min, then hourly)", () => {}); // Review Focus 4
test("send ok -> markSent, not retried", () => {});
test("project without telegram config -> nothing enqueued, no error", () => {});
```

- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** avec `fetch` vers `https://api.telegram.org/bot<token>/sendMessage` (`message_thread_id` si `threadId`), sans mode de mise en forme.
- [ ] **Step 4: Lancer** — PASS.
- [ ] **Step 5: Commit** `feat: telegram alerts with retry outbox`

### Task 6: Serveur Hono et anti-spam

**Files:**
- Create: `src/server/app.ts`
- Test: `tests/server/app.test.ts`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: `createApp(opts: { projects: Project[]; secret: string; now?: () => Date }): Hono`

Routes : `GET /:form` (page), `POST /:form` (envoi), `GET /:form/thanks`, `GET /_qf/app.js`, `GET /_qf/app.css`. Hôte inconnu ou formulaire inconnu → 404 générique (`renderNotFoundPage`), sans nommer d'autre projet.

- [ ] **Step 1: Tests qui échouent** (via `app.request`, en-tête `Host`)

```ts
test("valid POST -> 303 to /<form>/thanks, one row, one outbox item", () => {});
test("invalid POST -> 422 with page re-rendered: values kept, error summary, aria-invalid", () => {}); // Review Focus 3
test("honeypot filled -> 303 to thanks, nothing stored", () => {});
test("_t younger than 3 s or bad signature -> 303 to thanks, nothing stored", () => {});
test("more than 10 POST per IP per 10 min -> 429", () => {});
test("unknown host and unknown form -> 404 without project names", () => {});
test("responses carry Content-Security-Policy default-src 'self'; img-src 'self' https: data:", () => {});
```

- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter.** `_t` = horodatage signé HMAC-SHA256 avec `secret` ; `_sid` = `crypto.randomUUID()` au rendu ; IP lue dans `X-Forwarded-For` (Caddy) ; limite en mémoire. Après l'enregistrement, mise en file Telegram puis `flushOutbox` sans attendre la réponse.
- [ ] **Step 4: Lancer** — PASS.
- [ ] **Step 5: Commit** `feat: http server with spam protection`

### Task 7: Script client (amélioration progressive)

**Files:**
- Create: `src/client/form.ts`, script de build `scripts/build-client.ts` (`Bun.build`, minifié, sortie dans `dist/app.js`, embarqué par `app.ts`)
- Test: `tests/client/form.test.ts` (logique pure : navigation d'étapes, `showIf`, brouillon), `e2e/form.spec.ts` (Playwright 1.55.0, téléphone 390×844)

**Interfaces:**
- Consumes: `validateResponse`, `visibleFields`, `t` (Task 2) ; la définition est injectée dans la page en JSON (`<script type="application/json" id="qf-def">`).
- Produces: `dist/app.js`, moins de 25 Ko gzip.

Comportement : une étape visible à la fois, barre de progression fine en haut et « Étape 2 sur 4 » ; « Suivant » valide l'étape en cours et place le focus sur la première erreur ; la validation au fil de la saisie s'active seulement après la première sortie d'un champ ; les champs `showIf` apparaissent et disparaissent sans saut de page ; Entrée passe au champ suivant (pas dans un texte long) ; touches A, B, C pour les choix quand le focus est dans le groupe ; brouillon dans `localStorage` (clé `qf:<host>:<form>:<version>`), restauré avec un message discret et effacé après envoi ; bouton désactivé pendant l'envoi ; `prefers-reduced-motion` respecté.

- [ ] **Step 1: Tests qui échouent** (unitaires et e2e : remplir le formulaire d'exemple au clavier seul sur 390 px, recharger en cours de route → brouillon restauré, envoi → page de remerciement)
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Lancer** `bun test tests/client` et `npx -y playwright@1.55.0 test` — PASS ; vérifier la taille gzip.
- [ ] **Step 5: Commit** `feat: progressive enhancement client`

### Task 8: CLI et exécutable unique

**Files:**
- Create: `src/cli/main.ts`, `scripts/build.ts`
- Test: `tests/cli/main.test.ts`

**Interfaces:**
- Consumes: `parseDefinition`, `loadProjects`, `openProjectDb`, `createApp`, `startOutboxLoop`.
- Produces : l'exécutable `dist/quikform` avec les commandes :
  - `quikform serve [--port 8787]` (lit `QUIKFORM_HOME`, `QUIKFORM_SECRET` ; purge quotidienne selon `retentionMonths`)
  - `quikform check <file.json>` → exit 0 et `ok <id> v<version>`, sinon exit 1 et une erreur par ligne
  - `quikform form put --project <slug> <file.json>` → vérifie puis copie dans `forms/` ; refuse si invalide ; version incrémentée si le contenu change
  - `quikform responses --project <slug> [--form <id>] [--limit 50] [--json]`
  - `quikform project init <slug> --domain <d> [--accent #rrggbb] [--name <brand>]`

- [ ] **Step 1: Tests qui échouent** (exécuter la CLI dans un `QUIKFORM_HOME` temporaire : codes de sortie, refus d'une définition invalide, `--json` lisible par `JSON.parse`, aucun accès hors du projet passé en `--project`)
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** ; `scripts/build.ts` fait le build client puis `bun build --compile src/cli/main.ts --outfile dist/quikform`.
- [ ] **Step 4: Lancer** les tests, puis `bun run build && ./dist/quikform serve` dans un dossier d'exemple ; mesurer la RAM : `ps -o rss= -p <pid>` → moins de 100 000 Ko.
- [ ] **Step 5: Reporter les commandes réelles dans `AGENTS.md`** (section Stack et commandes) et écrire un `README.md` court (installation, format, CLI).
- [ ] **Step 6: Commit** `feat: cli and single binary build`

### Task 9: Finition visuelle contre les références

**Files:**
- Create: `examples/demo/project.json`, `examples/demo/forms/demo.json` (tous les types de champs, 3 étapes, un `showIf`), `design/shots/` (ignoré par git), `DESIGN.md`, `.impeccable/design.json`

- [ ] **Step 1:** Servir l'exemple en local ; capturer la page à 1440 px et à 390 px, aux états : repos, focus, erreurs, étape 2, remerciement (`npx -y playwright@1.55.0 screenshot …` dans `design/shots/`).
- [ ] **Step 2:** Comparer chaque capture aux lignes « ce qu'on prend » de `design/references/refs.md` ; lancer `"/home/hermes/.claude/plugins/cache/impeccable/impeccable/4.7.0/skills/impeccable/scripts/impeccable" detect --json src/render` ; corriger en un seul lot ; deuxième et dernière capture.
- [ ] **Step 3:** Revue `review-ui` (utilisabilité, WCAG, finition) ; corriger les points de sévérité haute.
- [ ] **Step 4:** Lancer l'agent `impeccable:impeccable-documenter` pour écrire `DESIGN.md` et `.impeccable/design.json` à partir du rendu construit.
- [ ] **Step 5: Commit** `design: visual finish and DESIGN.md`

### Task 10: Questionnaire de Meaw et mise en ligne

Requiert l'accord de Jon à chaque étape marquée ⚑.

**Files:**
- Create: `deploy/quikform.service`, `deploy/Caddyfile.snippet`, définition `meaw-pricing.json` (dans `$QUIKFORM_HOME/projects/wildcat/forms/`, hors dépôt)

- [ ] **Step 1:** Écrire `meaw-pricing.json` en anglais (`lang: "en"`) à partir des 17 questions envoyées à Meaw, en 4 étapes : Stay & Train (questions 1 à 5), Training only (6 à 9), DTV (10 à 14), Other (15 à 17). Chaque question de vérification est un `yes_no` (« Still correct? ») suivi d'un `long_text` « Correction » visible seulement si la réponse est non ; les questions ouvertes sont en `long_text` ou en `number`. `quikform check` → ok.
- [ ] **Step 2:** Installer `$QUIKFORM_HOME` (`~/.local/share/quikform`), `quikform project init wildcat --domain formulaire.wildcatmuaythai.com --name "Wildcat Muay Thai"`, `.env` avec le jeton du bot et le `chatId` fournis par Jon ; service systemd utilisateur (`deploy/quikform.service`, `Restart=on-failure`, `MemoryMax=150M`).
- [ ] **Step 3 ⚑:** Jon pose l'enregistrement DNS `formulaire.wildcatmuaythai.com` vers le serveur (A `187.77.71.11`, AAAA `2a02:4780:79:fe7e::1`).
- [ ] **Step 4 ⚑:** Ajouter le bloc du domaine au Caddyfile (`reverse_proxy 127.0.0.1:8787`) ; `caddy validate`, puis rechargement. Si le rechargement demande `sudo`, Jon le lance depuis son terminal SSH.
- [ ] **Step 5:** Vérifier : `curl -sI https://formulaire.wildcatmuaythai.com/meaw-pricing` → 200 ; un envoi de test → ligne en base (`quikform responses --project wildcat`) et alerte Telegram reçue ; supprimer la réponse de test.
- [ ] **Step 6 ⚑:** Envoyer le lien à Meaw (Jon).
- [ ] **Step 7:** Mettre à jour `docs/project/handoff.md` ; commit `chore: deploy files and step 1 handoff`.
