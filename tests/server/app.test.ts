import { afterAll, afterEach, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import steps from "../fixtures/steps.json";
import { parseDefinition } from "../../src/definition/schema";
import { openProjectDb } from "../../src/store/db";
import type { Project } from "../../src/projects/registry";
import { createApp } from "../../src/server/app";

const parsed = parseDefinition({ ...steps, notify: { telegram: true } });
if (!parsed.ok) throw new Error(parsed.errors.join());
const def = parsed.value;
// Telegram never answers: the alert stays in the outbox and no real request leaves the machine.
const realFetch = globalThis.fetch;
globalThis.fetch = (() => new Promise(() => {})) as unknown as typeof fetch;
afterAll(() => {
  globalThis.fetch = realFetch; // bun shares globals across test files
});
const SECRET = "s3cret";
const T0 = 1_800_000_000_000;

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qf-app-"));
  dirs.push(dir);
  const project: Project = {
    slug: "acme", dir, domains: ["forms.acme.test"], brand: { name: "Acme", accent: "#0a5" }, retentionMonths: 12,
    telegram: { chatId: "1", botToken: "tok" }, forms: new Map([[def.id, def]]),
    db: openProjectDb(path.join(dir, "data.sqlite")), loadErrors: [],
  };
  const clock = { ms: T0 + 60_000 };
  const app = createApp({ projects: [project], secret: SECRET, now: () => new Date(clock.ms) });
  return { project, app, clock };
}
const sign = (ms: number, secret = SECRET) => `${ms}.${createHmac("sha256", secret).update(String(ms)).digest("hex")}`;
const post = (app: ReturnType<typeof setup>["app"], fields: Record<string, string | string[]>, { host = "forms.acme.test", ip = "1.1.1.1" } = {}) => {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) body.append(k, x);
  return app.request(`/${def.id}`, { method: "POST", body, headers: { host, "x-forwarded-for": `9.9.9.9, ${ip}` } });
};
const good = (over: Record<string, string | string[]> = {}) => ({ _sid: crypto.randomUUID(), _t: sign(T0), name: "Ana", contacted: "yes", tags: ["a", "b"], ...over });
const count = (p: Project) => p.db.listResponses({}).length;

test("valid POST -> 303 to thanks, one row, one outbox item", async () => {
  const { app, project } = setup();
  const res = await post(app, good());
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe(`/${def.id}/thanks`);
  expect(count(project)).toBe(1);
  expect(project.db.listResponses({})[0]!.values.tags).toEqual(["a", "b"]);
  expect(project.db.outbox.due(new Date(T0 + 10 * 60_000))).toHaveLength(1);
});

test("same _sid twice -> 303 both times, one row, one alert", async () => {
  const { app, project } = setup();
  const f = good();
  expect((await post(app, f)).status).toBe(303);
  expect((await post(app, f)).status).toBe(303);
  expect(count(project)).toBe(1);
  expect(project.db.outbox.due(new Date(T0 + 10 * 60_000))).toHaveLength(1);
});

test("invalid POST -> 422 page re-rendered with values, summary, aria-invalid, kept _sid, fresh _t", async () => {
  const { app, project } = setup();
  const sid = crypto.randomUUID();
  const res = await post(app, good({ _sid: sid, name: "", email: "ana@x.test", contacted: "yes", color: "bad", tags: "a" }));
  expect(res.status).toBe(422);
  const html = await res.text();
  expect(html).toContain("qf-summary");
  expect(html).toContain("aria-invalid");
  expect(res.headers.get("location")).toBeNull();
  expect(html).toContain('href="#name"');
  expect(html).toContain('name="email" placeholder="a@b.c" value="ana@x.test"');
  expect(html).toMatch(/<input type="checkbox" id="tags:0" name="tags" value="a" checked/);
  expect(html).toContain(`name="_sid" value="${sid}"`);
  expect(html).toContain(`value="${T0 + 60_000}.`);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(count(project)).toBe(0);
  const bad = await (await post(app, good({ _sid: "nope", name: "" }))).text();
  expect(bad).not.toContain('value="nope"');
});

test("honeypot filled -> 303 to thanks, nothing stored", async () => {
  const { app, project } = setup();
  const res = await post(app, good({ website: "http://spam" }));
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe(`/${def.id}/thanks`);
  expect(count(project)).toBe(0);
});

test("_t younger than 3 s, future, bad signature or malformed -> 303 to thanks, nothing stored", async () => {
  const { app, project, clock } = setup();
  clock.ms = T0 + 2999;
  for (const _t of [sign(T0), sign(T0 + 10_000), sign(T0, "other"), "garbage", "", `${T0}.${"0".repeat(64)}`]) {
    const res = await post(app, good({ _t }));
    expect(res.status).toBe(303);
  }
  expect(count(project)).toBe(0);
  clock.ms = T0 + 3000;
  await post(app, good());
  expect(count(project)).toBe(1);
});

test("more than 10 POST per IP per 10 min -> 429, window then resets, other IP unaffected", async () => {
  const { app, clock } = setup();
  for (let i = 0; i < 10; i++) expect((await post(app, good({ website: "x" }))).status).toBe(303);
  expect((await post(app, good())).status).toBe(429);
  expect((await post(app, good(), { ip: "2.2.2.2" })).status).toBe(303);
  clock.ms += 10 * 60_000 + 1;
  expect((await post(app, good())).status).toBe(303);
});

test("unknown host and unknown form -> identical 404 without project names", async () => {
  const { app } = setup();
  const a = await app.request(`/${def.id}`, { headers: { host: "evil.test" } });
  const b = await app.request("/nope", { headers: { host: "forms.acme.test" } });
  const c = await app.request("/_qf/brand.css", { headers: { host: "evil.test" } });
  const d = await app.request("/nope/thanks/more", { headers: { host: "forms.acme.test" } });
  for (const r of [a, b, c, d]) expect(r.status).toBe(404);
  const [ta, tb] = [await a.text(), await b.text()];
  expect(ta).toBe(tb);
  expect(ta).not.toContain("Acme");
  expect(ta).not.toContain("acme");
});

test("GET form, thanks, css and the client script", async () => {
  const { app } = setup();
  const h = { host: "forms.acme.test" };
  const form = await app.request(`/${def.id}`, { headers: h });
  expect(form.status).toBe(200);
  expect(form.headers.get("cache-control")).toBe("no-store");
  const html = await form.text();
  expect(html).toContain('name="_t"');
  const thanks = await app.request(`/${def.id}/thanks`, { headers: h });
  expect(thanks.status).toBe(200);
  expect(thanks.headers.get("cache-control")).toBe("no-store");
  const app_css = await app.request("/_qf/app.css", { headers: h });
  expect(app_css.headers.get("content-type")).toContain("text/css");
  expect((await app.request("/_qf/brand.css", { headers: h })).headers.get("content-type")).toContain("text/css");
  const js = await app.request("/_qf/app.js", { headers: h });
  expect(js.status).toBe(200);
  expect(js.headers.get("content-type")).toContain("application/javascript");
  expect(await js.text()).toBe(await Bun.file(path.join(import.meta.dir, "../../dist/app.js")).text());
});

test("every response carries the security headers", async () => {
  const { app } = setup();
  for (const [p, host] of [[`/${def.id}`, "forms.acme.test"], ["/nope", "evil.test"], ["/_qf/app.css", "evil.test"]] as const) {
    const res = await app.request(p, { headers: { host } });
    expect(res.headers.get("content-security-policy")).toBe("default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("same-origin");
  }
});

test("fonts named in app.css are served as immutable woff2; unknown font -> 404", async () => {
  const { app } = setup();
  const css = await (await app.request("/_qf/app.css")).text();
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]!);
  expect(urls).toHaveLength(2);
  for (const u of urls) {
    expect(u).toStartWith("/_qf/fonts/");
    const res = await app.request(u);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("font/woff2");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    const file = path.join(import.meta.dir, "../../src/render/fonts", path.basename(u));
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array(fs.readFileSync(file)));
  }
  expect((await app.request("/_qf/fonts/nope.woff2")).status).toBe(404);
  expect((await app.request("/_qf/fonts/OFL.txt")).status).toBe(404);
});

test("GET /_qf/logo serves the project's logo file; no logo, missing file or unknown host -> 404", async () => {
  const { app, project } = setup();
  const h = { host: "forms.acme.test" };
  expect((await app.request("/_qf/logo", { headers: h })).status).toBe(404);
  fs.writeFileSync(path.join(project.dir, "logo.png"), "png bytes");
  project.brand = { ...project.brand, logo: "logo.png" };
  const png = await app.request("/_qf/logo", { headers: h });
  expect(png.status).toBe(200);
  expect(png.headers.get("content-type")).toBe("image/png");
  expect(png.headers.get("cache-control")).toBe("public, max-age=3600");
  expect(await png.text()).toBe("png bytes");
  expect(png.headers.get("content-security-policy")).toStartWith("default-src 'self';");
  expect((await app.request("/_qf/logo", { headers: { host: "evil.test" } })).status).toBe(404);

  fs.writeFileSync(path.join(project.dir, "Logo.SVG"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
  project.brand = { ...project.brand, logo: "Logo.SVG" };
  const svg = await app.request("/_qf/logo", { headers: h });
  expect(svg.headers.get("content-type")).toBe("image/svg+xml");
  // A directly opened SVG must not run script.
  expect(svg.headers.get("content-security-policy")).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox");

  project.brand = { ...project.brand, logo: "gone.webp" };
  const gone = await app.request("/_qf/logo", { headers: h });
  expect(gone.status).toBe(404);
  expect(gone.headers.get("content-type")).toContain("text/html");
});

test("body over 64 KB -> 413, nothing stored", async () => {
  const { app, project } = setup();
  const res = await post(app, good({ name: "x".repeat(70_000) }));
  expect(res.status).toBe(413);
  expect(count(project)).toBe(0);
});
