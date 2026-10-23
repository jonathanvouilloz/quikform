import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { parseDefinition } from "../definition/schema";
import { startOutboxLoop } from "../notify/telegram";
import { HOSTNAME, projectUrl, readSettings, syncProjects, type Project } from "../projects/registry";
import { createApp } from "../server/app";
import { cutoff, openProjectDb } from "../store/db";

const USAGE = `usage:
  quikform serve [--port 8787] [--host 127.0.0.1]
  quikform check <file.json>
  quikform form put --project <slug> <file.json>
  quikform responses --project <slug> [--form <id>] [--limit 50] [--json]
  quikform link create --project <slug> --form <id> --label <text>
  quikform link list --project <slug> [--form <id>] [--json]
  quikform link revoke --project <slug> <token>
  quikform project init <slug> [--domain <host>] [--accent #rrggbb] [--name <brand>]
environment: QUIKFORM_HOME (default ~/.local/share/quikform), QUIKFORM_SECRET (serve, 32+ characters)
settings: $QUIKFORM_HOME/quikform.json, e.g. {"baseDomain": "forms.example.com"}`;

class Fail extends Error {
  constructor(message: string, readonly code = 1) {
    super(message);
  }
}

const SLUG = /^[a-z][a-z0-9-]{0,47}$/;
const SLUG_ID = /^[a-z][a-z0-9_-]{0,47}$/;
const RELOAD_MS = 10_000;
const PURGE_MS = 24 * 3600_000;

function home(): string {
  const data = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return process.env.QUIKFORM_HOME || path.join(data, "quikform");
}

function settings() {
  try {
    return readSettings(home());
  } catch (e) {
    throw new Fail(e instanceof Error ? e.message : String(e));
  }
}

// Resolves only $QUIKFORM_HOME/projects/<slug>; the slug pattern rules out any path separator.
function projectDir(slug: string | undefined): string {
  if (!slug || !SLUG.test(slug)) throw new Fail(`invalid project slug "${slug ?? ""}"`);
  const dir = path.join(home(), "projects", slug);
  if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) throw new Fail(`unknown project "${slug}"`);
  return dir;
}

function readDefinition(file: string | undefined) {
  if (!file) throw new Fail("missing <file.json>", 2);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Fail(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const r = parseDefinition(raw);
  if (!r.ok) throw new Fail(r.errors.join("\n"));
  return { raw: raw as Record<string, unknown>, def: r.value };
}

function projectDomains(dir: string): string[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "project.json"), "utf8")).domains ?? [];
  } catch {
    return [];
  }
}

function check(args: string[]) {
  const { positionals } = parseArgs({ args, allowPositionals: true });
  const { def } = readDefinition(positionals[0]);
  console.log(`ok ${def.id} v${def.version}`);
}

function formPut(args: string[]) {
  const { values, positionals } = parseArgs({ args, options: { project: { type: "string" } }, allowPositionals: true });
  const dir = projectDir(values.project);
  const { raw, def } = readDefinition(positionals[0]);
  const target = path.join(dir, "forms", `${def.id}.json`);
  let version = def.version;
  if (fs.existsSync(target)) {
    let old: ReturnType<typeof parseDefinition> | undefined;
    try {
      old = parseDefinition(JSON.parse(fs.readFileSync(target, "utf8")));
    } catch {}
    if (old?.ok) {
      const { version: ov, ...oldRest } = old.value;
      const { version: _nv, ...newRest } = def;
      if (Bun.deepEquals(oldRest, newRest)) return console.log(`unchanged ${def.id} v${ov}`);
      version = ov + 1;
    }
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // Same directory, then rename: serve never sees a partial file. The .tmp name is not loaded as a form.
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ ...raw, version }, null, 2) + "\n");
  fs.renameSync(tmp, target);
  console.log(`ok ${def.id} v${version}`);
  const url = projectUrl({ slug: path.basename(dir), domains: projectDomains(dir) }, settings().baseDomain);
  if (url) console.log(`url ${url}/${def.id}`);
}

function responses(args: string[]) {
  const { values } = parseArgs({
    args,
    options: { project: { type: "string" }, form: { type: "string" }, limit: { type: "string", default: "50" }, json: { type: "boolean" } },
  });
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1) throw new Fail("--limit must be a positive integer", 2);
  const dir = projectDir(values.project);
  const db = openProjectDb(path.join(dir, "data.sqlite"));
  try {
    const rows = db.listResponses({ formId: values.form, limit }).map((r) => ({
      id: r.id, created_at: r.createdAt.toISOString(), form: r.formId, version: r.formVersion, values: r.values, link: r.link ?? null,
    }));
    if (values.json) console.log(JSON.stringify(rows, null, 2));
    else for (const r of rows) console.log([r.id, r.created_at, r.form, JSON.stringify(r.values), r.link ?? ""].join("\t"));
  } finally {
    db.close();
  }
}

// Opens the project's db for one command and always closes it.
function withDb<T>(dir: string, fn: (db: ReturnType<typeof openProjectDb>) => T): T {
  const db = openProjectDb(path.join(dir, "data.sqlite"));
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function linkUrl(dir: string, formId: string, token: string): string {
  const base = projectUrl({ slug: path.basename(dir), domains: projectDomains(dir) }, settings().baseDomain);
  if (!base) throw new Fail("project has no domain: set domains in project.json or baseDomain in quikform.json");
  return `${base}/${formId}?k=${token}`;
}

function linkCreate(args: string[]) {
  const { values } = parseArgs({ args, options: { project: { type: "string" }, form: { type: "string" }, label: { type: "string" } } });
  const dir = projectDir(values.project);
  if (!values.form || !values.label?.trim()) throw new Fail("--form and --label are required", 2);
  const file = path.join(dir, "forms", `${values.form}.json`);
  if (!SLUG_ID.test(values.form) || !fs.existsSync(file)) throw new Fail(`unknown form "${values.form}"`);
  const r = parseDefinition(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!r.ok) throw new Fail(`forms/${values.form}.json is invalid: ${r.errors.join("; ")}`);
  if (r.value.access !== "private") throw new Fail(`form is public: set "access": "private" first`);
  const token = withDb(dir, (db) => db.links.create(r.value.id, values.label!.trim()));
  console.log(linkUrl(dir, r.value.id, token));
}

function linkList(args: string[]) {
  const { values } = parseArgs({ args, options: { project: { type: "string" }, form: { type: "string" }, json: { type: "boolean" } } });
  const dir = projectDir(values.project);
  const rows = withDb(dir, (db) => db.links.list(values.form)).map((l) => ({
    label: l.label, form: l.formId, created_at: l.createdAt.toISOString(), revoked: l.revoked, token: l.token, url: linkUrl(dir, l.formId, l.token),
  }));
  if (values.json) console.log(JSON.stringify(rows, null, 2));
  else for (const l of rows) console.log([l.label, l.form, l.created_at, l.revoked ? "revoked" : "active", l.url].join("\t"));
}

function linkRevoke(args: string[]) {
  const { values, positionals } = parseArgs({ args, options: { project: { type: "string" } }, allowPositionals: true });
  const dir = projectDir(values.project);
  if (!positionals[0]) throw new Fail("missing <token>", 2);
  if (!withDb(dir, (db) => db.links.revoke(positionals[0]!))) throw new Fail("no active link with this token");
  console.log("revoked");
}

function projectInit(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: { domain: { type: "string" }, accent: { type: "string", default: "#111111" }, name: { type: "string" } },
    allowPositionals: true,
  });
  const slug = positionals[0];
  if (!slug || !SLUG.test(slug)) throw new Fail(`invalid project slug "${slug ?? ""}"`);
  if (values.domain === undefined ? !settings().baseDomain : !HOSTNAME.test(values.domain)) {
    throw new Fail("--domain must be a hostname, e.g. forms.example.com (optional once baseDomain is set in quikform.json)", 2);
  }
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(values.accent)) throw new Fail("--accent must be #rgb or #rrggbb", 2);
  const root = path.join(home(), "projects");
  fs.mkdirSync(root, { recursive: true });
  const dir = path.join(root, slug);
  if (fs.existsSync(dir)) throw new Fail(`project "${slug}" already exists`);
  fs.mkdirSync(path.join(dir, "forms"), { recursive: true });
  const config = { domains: values.domain ? [values.domain.toLowerCase()] : [], brand: { name: values.name ?? slug, accent: values.accent }, retentionMonths: 12 };
  fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify(config, null, 2) + "\n");
  console.log(`ok project ${slug} created in ${dir}`);
}

// One project's failure must not skip the others.
function purge(projects: Project[]) {
  for (const p of projects) {
    try {
      console.log(`purged ${p.db.purgeOlderThan(cutoff(new Date(), p.retentionMonths))} responses older than ${p.retentionMonths} months (project ${p.slug})`);
    } catch (e) {
      console.error(`quikform: purge failed (project ${p.slug}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// Bun exits on a throwing timer callback: one failed run is logged and the next one tries again.
const guarded = (name: string, fn: () => void) => () => {
  try {
    fn();
  } catch (e) {
    console.error(`quikform: ${name} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
};

function serve(args: string[]) {
  const { values } = parseArgs({ args, options: { port: { type: "string", default: "8787" }, host: { type: "string", default: "127.0.0.1" } } });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Fail("--port must be 0-65535", 2);
  // 127.0.0.1 unless told otherwise: in a container, 0.0.0.0 with the port published on the host's loopback only.
  if (!/^[0-9a-f:.]+$/i.test(values.host) && !HOSTNAME.test(values.host)) throw new Fail("--host must be an IP address or hostname", 2);
  const h = home();
  const secret = process.env.QUIKFORM_SECRET ?? "";
  if (secret.length < 32) throw new Fail("QUIKFORM_SECRET must be set to at least 32 characters");

  // Before listening, so a signal right after start exits 0. Handlers run on the event loop, once serve() has returned.
  process.on("SIGTERM", () => stop());
  process.on("SIGINT", () => stop());

  // Read once: changing baseDomain needs a restart.
  const { baseDomain } = settings();
  const projects: Project[] = [];
  const seen = new Map<string, string>();
  const reload = guarded("reload", () => syncProjects(h, projects, seen, baseDomain));
  const purgeAll = guarded("purge", () => purge(projects));
  reload();
  purgeAll();
  const server = Bun.serve({ hostname: values.host, port, fetch: createApp({ projects, secret, baseDomain }).fetch });
  console.log(`listening on ${values.host}:${server.port}`);
  // Load errors were already logged by syncProjects.
  for (const p of projects) console.log(`project ${p.slug}: ${p.forms.size} forms`);

  const stopOutbox = startOutboxLoop(projects);
  const timers = [setInterval(reload, RELOAD_MS), setInterval(purgeAll, PURGE_MS)];
  const stop = () => {
    timers.forEach(clearInterval);
    stopOutbox();
    void server.stop(true);
    projects.forEach((p) => p.db.close());
    process.exit(0);
  };
}

const commands: Record<string, (args: string[]) => void> = {
  serve, check, "form put": formPut, responses, "project init": projectInit,
  "link create": linkCreate, "link list": linkList, "link revoke": linkRevoke,
};

try {
  const argv = process.argv.slice(2);
  if (argv[0] === "--help" || argv[0] === "-h") console.log(USAGE);
  else {
    const two = `${argv[0]} ${argv[1]}`;
    const key = Object.hasOwn(commands, two) ? two : argv[0] ?? "";
    if (!Object.hasOwn(commands, key)) throw new Fail("unknown command", 2);
    commands[key]!(argv.slice(key.split(" ").length));
  }
} catch (e) {
  const code = e instanceof Fail ? e.code : (e as { code?: string }).code?.startsWith("ERR_PARSE_ARGS") ? 2 : 1;
  console.error(e instanceof Error ? e.message : String(e));
  if (code === 2) console.error(USAGE);
  process.exit(code);
}
