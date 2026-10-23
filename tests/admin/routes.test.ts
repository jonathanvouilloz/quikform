import { afterEach, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import steps from "../fixtures/steps.json";
import { parseDefinition } from "../../src/definition/schema";
import { openProjectDb } from "../../src/store/db";
import type { Project } from "../../src/projects/registry";
import { createApp } from "../../src/server/app";

const SECRET = "s".repeat(40);
const PASSWORD = "correct horse";
const HASH = await Bun.password.hash(PASSWORD, { algorithm: "argon2id" });
const priv = parseDefinition({ ...steps, id: "survey", access: "private" });
const pub = parseDefinition({ ...steps, id: "contact", title: "Contact" });
if (!priv.ok || !pub.ok) throw new Error("fixture");

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function project(slug: string, forms: Project["forms"]): Project {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qf-admin-"));
  dirs.push(dir);
  return { slug, dir, domains: [`${slug}.test`], brand: { name: slug.toUpperCase(), accent: "#0a5" }, retentionMonths: 12, forms,
    db: openProjectDb(path.join(dir, "data.sqlite")), loadErrors: [] };
}
function setup(admin = true) {
  const acme = project("acme", new Map([["survey", priv.ok ? priv.value : undefined!]]));
  const beta = project("beta", new Map([["contact", pub.ok ? pub.value : undefined!]]));
  const ana = acme.db.links.create("survey", "Ana");
  acme.db.links.create("survey", "Ben");
  acme.db.insertResponse({ submissionId: "s1", formId: "survey", formVersion: 2, values: { name: "<script>alert(1)</script>", contacted: "yes" }, link: "Ana" });
  const app = createApp({ projects: [acme, beta], secret: SECRET, ...(admin && { admin: { host: "admin.test", passwordHash: HASH, lang: "en" as const } }) });
  return { app, ana };
}
type App = ReturnType<typeof setup>["app"];
const req = (app: App, url: string, init: RequestInit & { cookie?: string } = {}) =>
  app.request(url, { ...init, headers: { host: "admin.test", "x-forwarded-for": "7.7.7.7", ...(init.cookie && { cookie: init.cookie }) } });
const login = (app: App, password = PASSWORD) => {
  const body = new URLSearchParams({ password });
  return app.request("/login", { method: "POST", body, headers: { host: "admin.test", "x-forwarded-for": "7.7.7.7" } });
};
async function session(app: App) {
  const res = await login(app);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

test("without admin settings every admin route is a 404", async () => {
  const { app } = setup(false);
  for (const url of ["/login", "/", "/p/acme"]) expect((await req(app, url)).status).toBe(404);
});

test("pages without a session redirect to /login; login page renders", async () => {
  const { app } = setup();
  for (const url of ["/", "/p/acme", "/p/acme/f/survey"]) {
    const r = await req(app, url);
    expect([r.status, r.headers.get("location")]).toEqual([303, "/login"]);
  }
  const page = await req(app, "/login");
  expect(page.status).toBe(200);
  expect(await page.text()).toContain('name="password"');
});

test("wrong password: 401, no cookie; right password: 303 and a strict cookie", async () => {
  const { app } = setup();
  const bad = await login(app, "nope");
  expect([bad.status, bad.headers.get("set-cookie")]).toEqual([401, null]);
  const ok = await login(app);
  expect([ok.status, ok.headers.get("location")]).toEqual([303, "/"]);
  const cookie = ok.headers.get("set-cookie")!;
  for (const attr of ["__Host-qf_admin=", "HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=2592000"]) expect(cookie).toContain(attr);
});

test("the 11th login attempt from one IP is 429, even with the right password", async () => {
  const { app } = setup();
  for (let i = 0; i < 10; i++) await login(app, "nope");
  expect((await login(app)).status).toBe(429);
});

test("projects, then forms with status and links, then answers question by question, escaped", async () => {
  const { app, ana } = setup();
  const cookie = await session(app);
  const home = await req(app, "/", { cookie });
  expect(home.headers.get("cache-control")).toBe("no-store");
  expect(home.headers.get("x-robots-tag")).toBe("noindex");
  const h = await home.text();
  expect(h).toContain('href="/p/acme"');
  expect(h).toContain('href="/p/beta"');

  const forms = await (await req(app, "/p/acme", { cookie })).text();
  expect(forms).toContain("In progress (1 of 2)");
  expect(forms).toContain(`https://acme.test/survey?k=${ana}`);
  expect(forms).toContain("Ben");
  const beta = await (await req(app, "/p/beta", { cookie })).text();
  expect(beta).toContain("https://beta.test/contact");
  expect(beta).toContain("No answers yet");

  const answers = await (await req(app, "/p/acme/f/survey", { cookie })).text();
  expect(answers).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(answers).not.toContain("<script>alert(1)");
  expect(answers).toContain("Nom");
  expect(answers).toContain("Ana");
  expect(answers).toContain("1 answer ·");
  expect(answers).toContain('href="/p/acme">ACME</a>');
});

test("unknown or malformed project and form ids are 404 with a session", async () => {
  const { app } = setup();
  const cookie = await session(app);
  for (const url of ["/p/nope", "/p/acme/f/nope", "/p/..%2Fx", "/p/acme/f/contact"]) expect((await req(app, url, { cookie })).status).toBe(404);
});

test("logout clears the cookie; a forged cookie goes back to /login", async () => {
  const { app } = setup();
  const cookie = await session(app);
  const out = await req(app, "/logout", { method: "POST", cookie });
  expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
  const forged = await req(app, "/", { cookie: "__Host-qf_admin=9999999999999.abc" });
  expect(forged.status).toBe(303);
});

test("forms on project hosts are unchanged", async () => {
  const { app } = setup();
  const r = await app.request("/contact", { headers: { host: "beta.test" } });
  expect(r.status).toBe(200);
});

test("/_qf/tls allows the admin host only when the admin is configured", async () => {
  const on = setup().app;
  const off = setup(false).app;
  expect((await on.request("/_qf/tls?domain=admin.test")).status).toBe(200);
  expect((await off.request("/_qf/tls?domain=admin.test")).status).toBe(404);
});

test("a cross-site POST /logout does not sign out", async () => {
  const { app } = setup();
  const r = await app.request("/logout", { method: "POST", headers: { host: "admin.test", "sec-fetch-site": "cross-site" } });
  expect([r.status, r.headers.get("set-cookie")]).toEqual([403, null]);
});

test("a successful sign-in does not count toward the limit", async () => {
  const { app } = setup();
  for (let i = 0; i < 12; i++) expect((await login(app)).status).toBe(303);
});
