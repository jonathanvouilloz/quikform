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
// Reads stdout until the listening line, or to the end if the process exits first.
async function untilListening(proc: { stdout: ReadableStream<Uint8Array> }) {
  const reader = proc.stdout.getReader();
  let out = "";
  while (!/listening on/.test(out)) {
    const { done, value } = await reader.read();
    if (done) break;
    out += new TextDecoder().decode(value);
  }
  reader.releaseLock();
  return out;
}
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
  const typo = qf(d, ["check", write(d, "c.json", { ...minimal, colour: "red" })]);
  expect([typo.code, typo.err.trim()]).toEqual([1, "(root): unrecognized keys colour"]);
});

test("usage errors exit 2, --help exits 0", () => {
  const d = tmp();
  expect(qf(d, ["nope"]).code).toBe(2);
  const inherited = qf(d, ["constructor"]);
  expect([inherited.code, inherited.err.includes("usage:")]).toEqual([2, true]);
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

test("project init without --domain needs baseDomain; form put prints the shared-domain url", () => {
  const home = tmp();
  expect(qf(home, ["project", "init", "demo"]).code).toBe(2);
  fs.writeFileSync(path.join(home, "quikform.json"), JSON.stringify({ baseDomain: "forms.test" }));
  expect(qf(home, ["project", "init", "demo"]).code).toBe(0);
  expect(JSON.parse(fs.readFileSync(path.join(home, "projects/demo/project.json"), "utf8")).domains).toEqual([]);
  const put = qf(home, ["form", "put", "--project", "demo", write(home, "f.json", minimal)]);
  expect(put.out.trim().split("\n")).toEqual([`ok ${minimal.id} v1`, `url https://demo.forms.test/${minimal.id}`]);
});

test("without QUIKFORM_HOME, home defaults to $XDG_DATA_HOME/quikform", () => {
  const xdg = tmp();
  const r = Bun.spawnSync(["bun", path.join(root, "src/cli/main.ts"), "project", "init", "x", "--domain", "x.test"], {
    env: { PATH: process.env.PATH!, XDG_DATA_HOME: xdg },
  });
  expect(r.exitCode).toBe(0);
  expect(fs.existsSync(path.join(xdg, "quikform/projects/x/project.json"))).toBe(true);
});

test("link create/list/revoke on a private form; refused on a public one; responses --json has link", () => {
  const home = setup();
  qf(home, ["form", "put", "--project", "acme", write(home, "f.json", minimal)]);
  const pub = qf(home, ["link", "create", "--project", "acme", "--form", minimal.id, "--label", "Olivier"]);
  expect(pub.code).toBe(1);
  expect(pub.err).toContain("form is public");
  qf(home, ["form", "put", "--project", "acme", write(home, "p.json", { ...minimal, access: "private" })]);
  const made = qf(home, ["link", "create", "--project", "acme", "--form", minimal.id, "--label", "Olivier"]);
  const m = new RegExp(`^https://forms\\.acme\\.test/${minimal.id}\\?k=([A-Za-z0-9_-]{32})$`).exec(made.out.trim());
  expect(m).not.toBeNull();
  expect(qf(home, ["link", "create", "--project", "acme", "--form", "nope", "--label", "x"]).code).toBe(1);
  expect(qf(home, ["link", "list", "--project", "acme"]).out).toContain("Olivier");
  expect(qf(home, ["link", "revoke", "--project", "acme", m![1]!]).code).toBe(0);
  expect(qf(home, ["link", "revoke", "--project", "acme", m![1]!]).code).toBe(1);
  const list = qf(home, ["link", "list", "--project", "acme", "--json"]);
  expect(JSON.parse(list.out)[0]).toMatchObject({ label: "Olivier", revoked: true, url: `https://forms.acme.test/${minimal.id}?k=${m![1]}` });
});

test("form put: refuses invalid, bumps version on change, no write when identical", () => {
  const home = setup();
  const target = path.join(home, "projects/acme/forms", `${minimal.id}.json`);
  const f = write(home, "f.json", minimal);
  expect(qf(home, ["form", "put", "--project", "acme", f]).out.trim()).toBe(`ok ${minimal.id} v1\nurl https://forms.acme.test/${minimal.id}`);
  expect(qf(home, ["form", "put", "--project", "acme", f]).out.trim()).toBe(`unchanged ${minimal.id} v1`);
  const changed = write(home, "g.json", { ...minimal, title: "Changed title" });
  expect(qf(home, ["form", "put", "--project", "acme", changed]).out.split("\n")[0]).toBe(`ok ${minimal.id} v2`);
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
  for (let i = 0; i < 3; i++) db.insertResponse({ submissionId: crypto.randomUUID(), formId: i < 2 ? "a" : "b", formVersion: 1, values: { n: `v${i}` }, link: i === 2 ? "Olivier" : undefined });
  db.close();
  const j = JSON.parse(qf(home, ["responses", "--project", "acme", "--json"]).out);
  expect(j).toHaveLength(3);
  expect(j[0]).toMatchObject({ form: "b", values: { n: "v2" }, link: "Olivier" });
  expect(j[1].link).toBeNull();
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
  // Without QUIKFORM_HOME the default home is used; a short secret is still refused before anything listens.
  expect(qf("", ["serve"], { QUIKFORM_HOME: "", XDG_DATA_HOME: tmp(), QUIKFORM_SECRET: "x" }).code).toBe(1);
});

test("serve --host sets the listening address (127.0.0.1 by default); a bad host is a usage error", async () => {
  const home = setup();
  const start = async (extra: string[]) => {
    const proc = Bun.spawn(["bun", path.join(root, "src/cli/main.ts"), "serve", "--port", "0", ...extra], {
      env: { PATH: process.env.PATH!, QUIKFORM_HOME: home, QUIKFORM_SECRET: "s".repeat(40) }, stdout: "pipe", stderr: "pipe",
    });
    try {
      return await untilListening(proc);
    } finally {
      proc.kill();
      await proc.exited;
    }
  };
  expect(await start([])).toContain("listening on 127.0.0.1:");
  expect(await start(["--host", "0.0.0.0"])).toContain("listening on 0.0.0.0:");
  expect(qf(home, ["serve", "--host", "not a host"], { QUIKFORM_SECRET: "s".repeat(40) }).code).toBe(2);
});

test("compiled binary serves /_qf/app.js and a font with their bytes, and exits 0 on SIGTERM", async () => {
  const home = setup();
  const bin = path.join(tmp(), "quikform");
  const b = Bun.spawnSync(["bun", "build", "--compile", "src/cli/main.ts", "--outfile", bin], { cwd: root });
  expect(b.exitCode).toBe(0);
  const proc = Bun.spawn([bin, "serve", "--port", "0"], {
    env: { QUIKFORM_HOME: home, QUIKFORM_SECRET: "s".repeat(40) }, stdout: "pipe", stderr: "pipe",
  });
  try {
    const port = /listening on 127\.0\.0\.1:(\d+)/.exec(await untilListening(proc))?.[1];
    expect(port).toBeDefined();
    const res = await fetch(`http://127.0.0.1:${port}/_qf/app.js`);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array(fs.readFileSync(path.join(root, "dist/app.js"))));
    const font = "plus-jakarta-sans-latin-wght-normal.woff2";
    const f = await fetch(`http://127.0.0.1:${port}/_qf/fonts/${font}`);
    expect(f.headers.get("content-type")).toBe("font/woff2");
    expect(new Uint8Array(await f.arrayBuffer())).toEqual(new Uint8Array(fs.readFileSync(path.join(root, "src/render/fonts", font))));
    proc.kill("SIGTERM");
    expect(await proc.exited).toBe(0);
  } finally {
    proc.kill();
  }
});

test("serve logs a failed reload and keeps running", async () => {
  const home = tmp();
  fs.writeFileSync(path.join(home, "projects"), "not a directory");
  const proc = Bun.spawn(["bun", path.join(root, "src/cli/main.ts"), "serve", "--port", "0"], {
    env: { PATH: process.env.PATH!, QUIKFORM_HOME: home, QUIKFORM_SECRET: "s".repeat(40) }, stdout: "pipe", stderr: "pipe",
  });
  try {
    expect(await untilListening(proc)).toContain("listening on");
    expect(proc.exitCode).toBeNull();
    proc.kill();
    await proc.exited;
    expect(await new Response(proc.stderr).text()).toStartWith("quikform: reload failed: ");
  } finally {
    proc.kill();
  }
});

test("serve exits 0 on a SIGTERM sent as soon as it says it is listening", async () => {
  const home = setup();
  for (let i = 0; i < 5; i++) {
    const proc = Bun.spawn(["bun", path.join(root, "src/cli/main.ts"), "serve", "--port", "0"], {
      env: { PATH: process.env.PATH!, QUIKFORM_HOME: home, QUIKFORM_SECRET: "s".repeat(40) }, stdout: "pipe", stderr: "pipe",
    });
    try {
      expect(await untilListening(proc)).toContain("listening on");
      proc.kill("SIGTERM");
      expect(await proc.exited).toBe(0);
    } finally {
      proc.kill();
    }
  }
});

test("purge: a failing project is logged and the others are still purged", async () => {
  const home = setup();
  expect(qf(home, ["project", "init", "zeta", "--domain", "z.test"]).code).toBe(0);
  const { openProjectDb } = await import("../../src/store/db");
  for (const slug of ["acme", "zeta"]) {
    const db = openProjectDb(path.join(home, "projects", slug, "data.sqlite"));
    db.insertResponse({ submissionId: crypto.randomUUID(), formId: "a", formVersion: 1, values: {}, createdAt: new Date(0) });
    db.close();
  }
  const { Database } = await import("bun:sqlite");
  const raw = new Database(path.join(home, "projects/acme/data.sqlite"));
  raw.run("CREATE TRIGGER no_delete BEFORE DELETE ON responses BEGIN SELECT RAISE(ABORT, 'locked'); END");
  raw.close();
  const proc = Bun.spawn(["bun", path.join(root, "src/cli/main.ts"), "serve", "--port", "0"], {
    env: { PATH: process.env.PATH!, QUIKFORM_HOME: home, QUIKFORM_SECRET: "s".repeat(40) }, stdout: "pipe", stderr: "pipe",
  });
  try {
    const out = await untilListening(proc);
    expect(out).toContain("purged 1 responses older than 12 months (project zeta)");
    proc.kill();
    await proc.exited;
    const err = (await new Response(proc.stderr).text()).trim().split("\n");
    expect(err).toEqual(["quikform: purge failed (project acme): locked"]);
  } finally {
    proc.kill();
  }
});

test("admin hash-password hashes stdin with argon2id; empty input is a usage error", async () => {
  const run = (input: string) => {
    const r = Bun.spawnSync(["bun", path.join(root, "src/cli/main.ts"), "admin", "hash-password"], { stdin: Buffer.from(input), env: { PATH: process.env.PATH! } });
    return { code: r.exitCode, out: r.stdout.toString().trim() };
  };
  const ok = run("correct horse\n");
  expect(ok.code).toBe(0);
  expect(ok.out).toStartWith("$argon2id$");
  expect(await Bun.password.verify("correct horse", ok.out)).toBe(true);
  expect(run("\n").code).toBe(2);
});

test("serve enables the admin only with adminHost and QUIKFORM_ADMIN_PASSWORD_HASH", async () => {
  const home = setup();
  fs.writeFileSync(path.join(home, "quikform.json"), JSON.stringify({ adminHost: "admin.test", adminLang: "fr" }));
  const hash = await Bun.password.hash("pw", { algorithm: "argon2id" });
  const status = async (env: Record<string, string>) => {
    const proc = Bun.spawn(["bun", path.join(root, "src/cli/main.ts"), "serve", "--port", "0"], {
      env: { PATH: process.env.PATH!, QUIKFORM_HOME: home, QUIKFORM_SECRET: "s".repeat(40), ...env }, stdout: "pipe", stderr: "pipe",
    });
    try {
      const port = /listening on [^:]+:(\d+)/.exec(await untilListening(proc))![1];
      const r = await fetch(`http://127.0.0.1:${port}/login`, { headers: { host: "admin.test" } });
      return [r.status, (await r.text()).includes("Mot de passe")];
    } finally {
      proc.kill();
      await proc.exited;
    }
  };
  expect(await status({ QUIKFORM_ADMIN_PASSWORD_HASH: hash })).toEqual([200, true]);
  expect((await status({}))[0]).toBe(404);
});
