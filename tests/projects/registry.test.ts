import { afterEach, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import minimal from "../fixtures/minimal.json";
import { loadProjects, resolveProject } from "../../src/projects/registry";

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
const pj = { domains: ["Forms.Example.com"], brand: { name: "Meaw", accent: "#aa3300" } };

test("an invalid form file is skipped, listed in loadErrors, other forms still load", () => {
  const h = home({
    "a/project.json": pj,
    "a/forms/contact.json": minimal,
    "a/forms/broken.json": { id: "broken" },
    "a/forms/other.json": minimal, // id "contact" != filename
    "a/forms/bad-json.json": "{nope",
  });
  const [p] = loadProjects(h);
  expect([...p!.forms.keys()]).toEqual(["contact"]);
  expect(p!.loadErrors).toHaveLength(3);
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
  expect(errors.join()).toContain("c");
});

test("a project without project.json is skipped, others load", () => {
  const h = home({ "x/forms/a.json": minimal, "a/project.json": pj });
  const orig = console.error;
  console.error = () => {};
  const ps = loadProjects(h);
  console.error = orig;
  expect(ps.map((p) => p.slug)).toEqual(["a"]);
});
