import { afterEach, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import minimal from "../fixtures/minimal.json";
import { loadProjects, resolveProject, syncProjects, type Project } from "../../src/projects/registry";

const dirs: string[] = [];
function home(files: Record<string, unknown>): string {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "qf-home-"));
  dirs.push(h);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(h, "projects", rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof content === "string" ? content : JSON.stringify(content));
  }
  return h;
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const pj = { domains: ["Forms.Example.com"], brand: { name: "Example", accent: "#aa3300" } };

test("an invalid form file is skipped, listed in loadErrors, other forms still load", () => {
  const h = home({
    "a/project.json": pj,
    "a/forms/contact.json": minimal,
    "a/forms/broken.json": { id: "broken" },
    "a/forms/other.json": minimal, // id "contact" != filename
    "a/forms/bad-json.json": "{nope",
  });
  const logged: string[] = [];
  const log = console.error;
  console.error = (m: string) => void logged.push(m);
  const [p] = loadProjects(h);
  console.error = log;
  expect([...p!.forms.keys()]).toEqual(["contact"]);
  expect(p!.loadErrors).toHaveLength(3);
  // Logged once each, on the first load.
  expect(logged).toEqual(p!.loadErrors.map((e) => `quikform: project "a": ${e}`));
  expect(p!.retentionMonths).toBe(12);
});

test("resolveProject matches host case-insensitively, ignores port", () => {
  const h = home({ "a/project.json": pj, "b/project.json": { ...pj, domains: ["other.test"] } });
  const ps = loadProjects(h);
  expect(resolveProject(ps, "FORMS.example.com:8080")?.slug).toBe("a");
  expect(resolveProject(ps, "other.test")?.slug).toBe("b");
  expect(resolveProject(ps, "nope.test")).toBeUndefined();
});

test("token is read from the project's .env, never from project.json", () => {
  const tg = { chatId: "-100", threadId: 7 };
  const h = home({
    "a/project.json": { ...pj, telegram: tg },
    "a/.env": "# c\nOTHER=x\nTELEGRAM_BOT_TOKEN=\"abc:123\"\n",
    "b/project.json": { ...pj, domains: ["b.test"], telegram: tg },
    "c/project.json": { ...pj, domains: ["c.test"], telegram: { ...tg, botToken: "leak" } },
  });
  const errors: string[] = [];
  const orig = console.error;
  console.error = (m: string) => errors.push(m);
  const ps = loadProjects(h);
  console.error = orig;
  expect(ps.find((p) => p.slug === "a")?.telegram).toEqual({ ...tg, botToken: "abc:123" });
  const b = ps.find((p) => p.slug === "b")!;
  expect(b.telegram).toBeUndefined();
  expect(b.loadErrors.join()).toContain("TELEGRAM_BOT_TOKEN");
  expect(ps.find((p) => p.slug === "c")).toBeUndefined();
  expect(errors.join()).toContain(`skipping project "c"`);
  expect(errors.join()).toContain("unrecognized keys botToken");
});

test("a project without project.json is skipped, others load", () => {
  const h = home({ "x/forms/a.json": minimal, "a/project.json": pj });
  const orig = console.error;
  console.error = () => {};
  const ps = loadProjects(h);
  console.error = orig;
  expect(ps.map((p) => p.slug)).toEqual(["a"]);
});

test("the demo project in examples/ loads without errors", () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "qf-home-"));
  dirs.push(h);
  fs.cpSync(path.join(import.meta.dir, "../../examples/demo"), path.join(h, "projects/demo"), { recursive: true });
  const [p] = loadProjects(h);
  expect(p?.loadErrors).toEqual([]);
  const demo = p!.forms.get("demo")!;
  expect(demo.steps).toHaveLength(3);
  expect(new Set(demo.steps.flatMap((s) => s.fields.map((f) => f.type))).size).toBe(7);
});

test("syncProjects loads, reloads in place keeping the db handle, drops removed projects", () => {
  const h = home({ "a/project.json": pj, "a/forms/contact.json": minimal });
  const projects: Project[] = [];
  const seen = new Map<string, string>();
  syncProjects(h, projects, seen);
  const db = projects[0]!.db;
  expect(projects[0]!.forms.size).toBe(1);

  fs.writeFileSync(path.join(h, "projects/a/forms/second.json"), JSON.stringify({ ...minimal, id: "second" }));
  fs.utimesSync(path.join(h, "projects/a/forms"), new Date(), new Date(Date.now() + 5000));
  fs.writeFileSync(path.join(h, "projects/a/forms/broken.json"), "{nope");
  const logged: string[] = [];
  const log = console.error;
  console.error = (m: string) => void logged.push(m);
  syncProjects(h, projects, seen);
  console.error = log;
  expect(projects).toHaveLength(1);
  expect(projects[0]!.forms.size).toBe(2);
  expect(projects[0]!.db).toBe(db);
  // Load errors of a reload are logged, one line each.
  expect(logged).toHaveLength(1);
  expect(logged[0]).toStartWith('quikform: project "a": forms/broken.json: ');

  // A broken project.json keeps the previous good version.
  fs.writeFileSync(path.join(h, "projects/a/project.json"), "{nope");
  fs.utimesSync(path.join(h, "projects/a/project.json"), new Date(), new Date(Date.now() + 9000));
  console.error = () => {};
  syncProjects(h, projects, seen);
  console.error = log;
  expect(projects[0]!.forms.size).toBe(2);

  fs.mkdirSync(path.join(h, "projects/b/forms"), { recursive: true });
  fs.writeFileSync(path.join(h, "projects/b/project.json"), JSON.stringify(pj));
  fs.writeFileSync(path.join(h, "projects/b/forms/broken.json"), "{nope");
  logged.length = 0;
  console.error = (m: string) => void logged.push(m);
  syncProjects(h, projects, seen);
  console.error = log;
  // A project added while serve runs logs its load errors too.
  expect(logged).toHaveLength(1);
  expect(logged[0]).toStartWith('quikform: project "b": forms/broken.json: ');
  expect(projects.map((p) => p.slug).sort()).toEqual(["a", "b"]);

  fs.rmSync(path.join(h, "projects/b"), { recursive: true });
  syncProjects(h, projects, seen);
  expect(projects.map((p) => p.slug)).toEqual(["a"]);
});

test("brand.logo: a plain file name in the project folder, image extension, at most 200 KB", () => {
  const withLogo = (logo: string) => ({ ...pj, brand: { ...pj.brand, logo } });
  const h = home({
    "ok/project.json": withLogo("logo.png"),
    "ok/logo.png": "png bytes",
    "svg/project.json": { ...withLogo("Mark.SVG"), domains: ["svg.test"] },
    "svg/Mark.SVG": "<svg/>",
    "missing/project.json": { ...withLogo("logo.webp"), domains: ["missing.test"] },
    "big/project.json": { ...withLogo("logo.jpg"), domains: ["big.test"] },
    "big/logo.jpg": "x".repeat(200 * 1024 + 1),
    "dir/project.json": { ...withLogo("logo.jpeg"), domains: ["dir.test"] },
    "dir/logo.jpeg/x": "",
    "up/project.json": { ...withLogo("../logo.png"), domains: ["up.test"] },
    "sub/project.json": { ...withLogo("img/logo.png"), domains: ["sub.test"] },
    "dots/project.json": { ...withLogo("a..png"), domains: ["dots.test"] },
    "gif/project.json": { ...withLogo("logo.gif"), domains: ["gif.test"] },
    "url/project.json": { ...pj, domains: ["url.test"], brand: { ...pj.brand, logoUrl: "https://x.test/l.png" } },
  });
  const orig = console.error;
  console.error = () => {};
  const ps = loadProjects(h);
  console.error = orig;
  const by = (slug: string) => ps.find((p) => p.slug === slug);
  expect([by("ok")!.brand.logo, by("ok")!.loadErrors]).toEqual(["logo.png", []]);
  expect(by("svg")!.brand.logo).toBe("Mark.SVG");
  for (const slug of ["missing", "big", "dir"]) {
    expect(by(slug)!.brand.logo).toBeUndefined();
    expect(by(slug)!.loadErrors).toHaveLength(1);
    expect(by(slug)!.loadErrors[0]).toStartWith("brand.logo: ");
  }
  for (const slug of ["up", "sub", "dots", "gif", "url"]) expect(by(slug)).toBeUndefined();
});
