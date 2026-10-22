import fs from "node:fs";
import path from "node:path";
import * as z from "zod/mini";
import { formatIssue, parseDefinition, type FormDefinition } from "../definition/schema";
import type { Brand } from "../render/page";
import { openProjectDb, type ProjectDb } from "../store/db";

export type Project = {
  slug: string;
  dir: string;
  domains: string[];
  brand: Brand;
  retentionMonths: number;
  telegram?: { chatId: string; threadId?: number; botToken: string };
  forms: Map<string, FormDefinition>;
  db: ProjectDb;
  loadErrors: string[];
};

export const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
const Hostname = z.string().check(z.regex(HOSTNAME));
// A plain file name in the project folder: no path separator, no "..", an image extension.
const LOGO = /^(?!.*\.\.)[^/\\]+\.(png|jpe?g|webp|svg)$/i;
const LOGO_MAX_BYTES = 200 * 1024;
// Strict objects: a stray key (a botToken in particular) rejects the whole file.
const ProjectConfig = z.strictObject({
  domains: z.array(Hostname).check(z.minLength(1)),
  brand: z.strictObject({
    name: z.string().check(z.minLength(1)),
    logo: z.optional(z.string().check(z.regex(LOGO))),
    accent: z.string(),
  }),
  retentionMonths: z._default(z.int().check(z.positive()), 12),
  telegram: z.optional(z.strictObject({ chatId: z.string(), threadId: z.optional(z.int()) })),
});

// Bun only auto-loads .env from the cwd, so read the project's own file.
function readToken(file: string): string | undefined {
  if (!fs.existsSync(file)) return undefined;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*TELEGRAM_BOT_TOKEN\s*=\s*(.*?)\s*$/.exec(line);
    if (m) return m[1]!.replace(/^(["'])(.*)\1$/, "$2") || undefined;
  }
  return undefined;
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

function loadForms(dir: string, loadErrors: string[]): Map<string, FormDefinition> {
  const forms = new Map<string, FormDefinition>();
  const formsDir = path.join(dir, "forms");
  if (!fs.existsSync(formsDir)) return forms;
  for (const file of fs.readdirSync(formsDir).filter((f) => f.endsWith(".json")).sort()) {
    try {
      const r = parseDefinition(JSON.parse(fs.readFileSync(path.join(formsDir, file), "utf8")));
      if (!r.ok) loadErrors.push(`forms/${file}: ${r.errors.join("; ")}`);
      else if (r.value.id !== file.slice(0, -5)) loadErrors.push(`forms/${file}: id "${r.value.id}" does not match the filename`);
      else forms.set(r.value.id, r.value);
    } catch (e) {
      loadErrors.push(`forms/${file}: ${reason(e)}`);
    }
  }
  return forms;
}

// Throws when project.json is missing or invalid. An already-open db can be passed in (reload keeps its handle).
export function loadProject(dir: string, db?: ProjectDb): Project {
  const parsed = z.safeParse(ProjectConfig, JSON.parse(fs.readFileSync(path.join(dir, "project.json"), "utf8")));
  if (!parsed.success) throw new Error(parsed.error.issues.map(formatIssue).join("; "));
  const config = parsed.data;
  const loadErrors: string[] = [];
  let telegram: Project["telegram"];
  if (config.telegram) {
    const botToken = readToken(path.join(dir, ".env"));
    if (botToken) telegram = { ...config.telegram, botToken };
    else loadErrors.push("telegram is configured but TELEGRAM_BOT_TOKEN is missing from .env");
  }
  const brand = { ...config.brand };
  if (brand.logo) {
    const stat = fs.statSync(path.join(dir, brand.logo), { throwIfNoEntry: false });
    const problem = !stat?.isFile() ? "file not found in the project folder" : stat.size > LOGO_MAX_BYTES ? "larger than 200 KB" : "";
    if (problem) {
      loadErrors.push(`brand.logo: ${brand.logo}: ${problem}`);
      delete brand.logo;
    }
  }
  return {
    slug: path.basename(dir),
    dir,
    domains: config.domains.map((d) => d.toLowerCase()),
    brand,
    retentionMonths: config.retentionMonths,
    telegram,
    forms: loadForms(dir, loadErrors),
    db: db ?? openProjectDb(path.join(dir, "data.sqlite")),
    loadErrors,
  };
}

// Brings `projects` (mutated in place, as createApp and the outbox loop hold it) in line with the disk.
// `seen` remembers each folder's signature; a changed one is reloaded, a failed reload keeps the previous version.
export function syncProjects(home: string, projects: Project[], seen: Map<string, string>): void {
  const root = path.join(home, "projects");
  const slugs = fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
  const mtime = (f: string) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
  for (const slug of slugs) {
    const dir = path.join(root, slug);
    const sig = ["project.json", ".env", "forms"].map((f) => mtime(path.join(dir, f))).join(":");
    if (seen.get(slug) === sig) continue;
    seen.set(slug, sig);
    const i = projects.findIndex((p) => p.slug === slug);
    try {
      const p = loadProject(dir, projects[i]?.db);
      if (i >= 0) projects[i] = p;
      else projects.push(p);
      for (const e of p.loadErrors) console.error(`quikform: project "${slug}": ${e}`);
    } catch (e) {
      console.error(`quikform: ${i >= 0 ? "keeping previous version of" : "skipping"} project "${slug}": ${reason(e)}`);
    }
  }
  for (const slug of [...seen.keys()].filter((s) => !slugs.includes(s))) {
    seen.delete(slug);
    const i = projects.findIndex((p) => p.slug === slug);
    if (i >= 0) projects.splice(i, 1)[0]!.db.close();
  }
}

export function loadProjects(home: string): Project[] {
  const projects: Project[] = [];
  syncProjects(home, projects, new Map());
  return projects;
}

export function resolveProject(projects: Project[], host: string): Project | undefined {
  const name = host.toLowerCase().replace(/:\d+$/, "");
  return projects.find((p) => p.domains.includes(name));
}
