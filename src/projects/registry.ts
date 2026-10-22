import fs from "node:fs";
import path from "node:path";
import * as z from "zod/mini";
import { parseDefinition, type FormDefinition } from "../definition/schema";
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

const Hostname = z.string().check(z.regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i));
// Strict objects: a stray key (a botToken in particular) rejects the whole file.
const ProjectConfig = z.strictObject({
  domains: z.array(Hostname).check(z.minLength(1)),
  brand: z.strictObject({
    name: z.string().check(z.minLength(1)),
    logoUrl: z.optional(z.url({ protocol: /^https$/ })),
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

export function loadProjects(home: string): Project[] {
  const root = path.join(home, "projects");
  if (!fs.existsSync(root)) return [];
  const projects: Project[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const dir = path.join(root, slug);
    let config: z.output<typeof ProjectConfig>;
    try {
      const parsed = z.safeParse(ProjectConfig, JSON.parse(fs.readFileSync(path.join(dir, "project.json"), "utf8")));
      if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      config = parsed.data;
    } catch (e) {
      console.error(`quikform: skipping project "${slug}": ${reason(e)}`);
      continue;
    }
    const loadErrors: string[] = [];
    let telegram: Project["telegram"];
    if (config.telegram) {
      const botToken = readToken(path.join(dir, ".env"));
      if (botToken) telegram = { ...config.telegram, botToken };
      else loadErrors.push("telegram is configured but TELEGRAM_BOT_TOKEN is missing from .env");
    }
    projects.push({
      slug,
      dir,
      domains: config.domains.map((d) => d.toLowerCase()),
      brand: config.brand,
      retentionMonths: config.retentionMonths,
      telegram,
      forms: loadForms(dir, loadErrors),
      db: openProjectDb(path.join(dir, "data.sqlite")),
      loadErrors,
    });
  }
  return projects;
}

export function resolveProject(projects: Project[], host: string): Project | undefined {
  const name = host.toLowerCase().replace(/:\d+$/, "");
  return projects.find((p) => p.domains.includes(name));
}
