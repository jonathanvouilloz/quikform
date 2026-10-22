import { afterEach, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import minimal from "../fixtures/minimal.json";

const root = path.join(import.meta.dir, "../..");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "qf-cli-"));
  dirs.push(d);
  return d;
};
function qf(home: string, args: string[], env: Record<string, string> = {}) {
  const r = Bun.spawnSync(["bun", path.join(root, "src/cli/main.ts"), ...args], {
    env: { PATH: process.env.PATH!, QUIKFORM_HOME: home, ...env },
  });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
}
const write = (dir: string, name: string, v: unknown) => {
  const f = path.join(dir, name);
  fs.writeFileSync(f, JSON.stringify(v));
  return f;
};
function setup() {
  const home = tmp();
  expect(qf(home, ["project", "init", "acme", "--domain", "forms.acme.test"]).code).toBe(0);
  return home;
}

test("check: ok line, then one error per line and exit 1", () => {
  const d = tmp();
  const good = qf(d, ["check", write(d, "a.json", minimal)]);
  expect([good.code, good.out.trim()]).toEqual([0, `ok ${minimal.id} v1`]);
  const bad = qf(d, ["check", write(d, "b.json", { id: "x" })]);
  expect(bad.code).toBe(1);
  expect(bad.err.trim().split("\n").length).toBeGreaterThan(1);
});

test("usage errors exit 2, --help exits 0", () => {
  const d = tmp();
  expect(qf(d, ["nope"]).code).toBe(2);
  expect(qf(d, ["check", "--bogus"]).code).toBe(2);
  const h = qf(d, ["--help"]);
  expect([h.code, h.out.startsWith("usage:")]).toEqual([0, true]);
});

test("project init writes project.json and forms/, refuses an existing project and bad values", () => {
  const home = setup();
  const cfg = JSON.parse(fs.readFileSync(path.join(home, "projects/acme/project.json"), "utf8"));
  expect(cfg).toEqual({ domains: ["forms.acme.test"], brand: { name: "acme", accent: "#111111" }, retentionMonths: 12 });
  expect(fs.existsSync(path.join(home, "projects/acme/forms"))).toBe(true);
  expect(fs.existsSync(path.join(home, "projects/acme/.env"))).toBe(false);
  expect(qf(home, ["project", "init", "acme", "--domain", "x.test"]).code).toBe(1);
  expect(qf(home, ["project", "init", "b", "--domain", "x.test", "--accent", "red"]).code).toBe(2);
  expect(qf(home, ["project", "init", "b", "--domain", "not a host"]).code).toBe(2);
  expect(qf(home, ["project", "init", "../evil", "--domain", "x.test"]).code).toBe(1);
});

test("form put: refuses invalid, bumps version on change, no write when identical", () => {
  const home = setup();
  const target = path.join(home, "projects/acme/forms", `${minimal.id}.json`);
  const f = write(home, "f.json", minimal);
  expect(qf(home, ["form", "put", "--project", "acme", f]).out.trim()).toBe(`ok ${minimal.id} v1`);
  expect(qf(home, ["form", "put", "--project", "acme", f]).out.trim()).toBe(`unchanged ${minimal.id} v1`);
  const changed = write(home, "g.json", { ...minimal, title: "Changed title" });
  expect(qf(home, ["form", "put", "--project", "acme", changed]).out.trim()).toBe(`ok ${minimal.id} v2`);
  expect(JSON.parse(fs.readFileSync(target, "utf8")).version).toBe(2);
  const before = fs.readFileSync(target, "utf8");
  const bad = qf(home, ["form", "put", "--project", "acme", write(home, "h.json", { id: minimal.id })]);
  expect(bad.code).toBe(1);
  expect(fs.readFileSync(target, "utf8")).toBe(before);
  expect(fs.readdirSync(path.dirname(target))).toEqual([`${minimal.id}.json`]);
});

test("responses: table, --json parses, --form and --limit filter", async () => {
  const home = setup();
  const { openProjectDb } = await import("../../src/store/db");
  const db = openProjectDb(path.join(home, "projects/acme/data.sqlite"));
  for (let i = 0; i < 3; i++) db.insertResponse({ submissionId: crypto.randomUUID(), formId: i < 2 ? "a" : "b", formVersion: 1, values: { n: `v${i}` } });
  db.close();
  const j = JSON.parse(qf(home, ["responses", "--project", "acme", "--json"]).out);
  expect(j).toHaveLength(3);
  expect(j[0]).toMatchObject({ form: "b", values: { n: "v2" } });
  expect(JSON.parse(qf(home, ["responses", "--project", "acme", "--json", "--form", "a", "--limit", "1"]).out)).toHaveLength(1);
  const table = qf(home, ["responses", "--project", "acme"]).out.trim().split("\n");
  expect(table).toHaveLength(3);
  expect(table[0]!.split("\t")[3]).toBe('{"n":"v2"}');
  expect(qf(home, ["responses", "--project", "acme", "--limit", "0"]).code).toBe(2);
});

test("project-scoped commands only touch the named project and reject bad slugs", () => {
  const home = setup();
  qf(home, ["project", "init", "other", "--domain", "o.test"]);
  // A sibling that would crash a whole-home load: the CLI must not read it.
  fs.writeFileSync(path.join(home, "projects/other/project.json"), "{broken");
  fs.mkdirSync(path.join(home, "projects/other/data.sqlite"));
  const f = write(home, "f.json", minimal);
  expect(qf(home, ["form", "put", "--project", "acme", f]).code).toBe(0);
  expect(qf(home, ["responses", "--project", "acme"]).code).toBe(0);
  for (const slug of ["../acme", "acme/../other", "/etc", "Acme", "missing", ""]) {
    expect(qf(home, ["responses", "--project", slug]).code).toBe(1);
    expect(qf(home, ["form", "put", "--project", slug, f]).code).toBe(1);
  }
  expect(fs.readdirSync(path.join(home, "projects/other/forms"))).toEqual([]);
});

test("serve refuses a missing or short secret without echoing it", () => {
  const home = setup();
  expect(qf(home, ["serve"]).code).toBe(1);
  const r = qf(home, ["serve"], { QUIKFORM_SECRET: "short-secret" });
  expect(r.code).toBe(1);
  expect(r.err + r.out).not.toContain("short-secret");
  expect(qf("", ["serve"], { QUIKFORM_HOME: "", QUIKFORM_SECRET: "x".repeat(40) }).code).toBe(1);
});

test("compiled binary serves /_qf/app.js with the bytes of dist/app.js and exits 0 on SIGTERM", async () => {
  const home = setup();
  const bin = path.join(tmp(), "quikform");
  const b = Bun.spawnSync(["bun", "build", "--compile", "src/cli/main.ts", "--outfile", bin], { cwd: root });
  expect(b.exitCode).toBe(0);
  const proc = Bun.spawn([bin, "serve", "--port", "0"], {
    env: { QUIKFORM_HOME: home, QUIKFORM_SECRET: "s".repeat(40) }, stdout: "pipe", stderr: "pipe",
  });
  const reader = proc.stdout.getReader();
  let out = "";
  while (!/listening on/.test(out)) out += new TextDecoder().decode((await reader.read()).value);
  const port = /listening on 127\.0\.0\.1:(\d+)/.exec(out)?.[1];
  expect(port).toBeDefined();
  const res = await fetch(`http://127.0.0.1:${port}/_qf/app.js`);
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array(fs.readFileSync(path.join(root, "dist/app.js"))));
  proc.kill("SIGTERM");
  expect(await proc.exited).toBe(0);
});
