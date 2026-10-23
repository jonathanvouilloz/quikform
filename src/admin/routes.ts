import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Project } from "../projects/registry";
import { projectUrl } from "../projects/registry";
import { checkSession, createLoginLimiter, signSession } from "./auth";
import { renderAnswers, renderForms, renderLogin, renderProjects, type AdminLang, type FormSummary } from "./pages";

export type AdminConfig = { host: string; passwordHash: string; lang: AdminLang };

// __Host-: only this exact host can set it, so a sibling subdomain cannot shadow it.
const COOKIE = "__Host-qf_admin";
const SESSION_MS = 30 * 24 * 3600_000;
const ID = /^[a-z][a-z0-9_-]{0,47}$/;

export function createAdmin(opts: {
  config: AdminConfig;
  projects: Project[];
  secret: string;
  baseDomain?: string;
  now: () => Date;
  clientIp: (c: Context) => string;
}): Hono {
  const { config, projects, secret, now } = opts;
  const { lang, passwordHash } = config;
  const limiter = createLoginLimiter();
  const app = new Hono();

  app.use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("X-Robots-Tag", "noindex");
  });
  const signedIn = (c: Context) => checkSession(secret, passwordHash, getCookie(c, COOKIE), now().getTime());
  const notFound = (c: Context) => c.text("Not Found", 404);

  app.get("/login", (c) => c.html(renderLogin(lang)));
  app.post("/login", bodyLimit({ maxSize: 4096, onError: (c) => c.text("Payload Too Large", 413) }), async (c) => {
    const ip = opts.clientIp(c);
    if (limiter.blocked(ip, now().getTime())) return c.html(renderLogin(lang, "tooMany"), 429);
    const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    const password = typeof body.password === "string" ? body.password : "";
    const ok = password !== "" && (await Bun.password.verify(password, passwordHash).catch(() => false));
    console.log(`quikform: admin login ${ok ? "ok" : "failed"} from ${ip}`);
    if (!ok) {
      limiter.fail(ip, now().getTime());
      return c.html(renderLogin(lang, "wrong"), 401);
    }
    const expires = now().getTime() + SESSION_MS;
    setCookie(c, COOKIE, signSession(secret, passwordHash, expires), {
      httpOnly: true, secure: true, sameSite: "Strict", path: "/", maxAge: SESSION_MS / 1000,
    });
    return c.redirect("/", 303);
  });
  app.post("/logout", (c) => {
    // SameSite does not cover a plain cross-site POST that only clears the cookie.
    if (c.req.header("sec-fetch-site") === "cross-site") return c.text("Forbidden", 403);
    deleteCookie(c, COOKIE, { path: "/", secure: true });
    return c.redirect("/login", 303);
  });

  // Everything below needs a session.
  app.use(async (c, next) => (signedIn(c) ? next() : c.redirect("/login", 303)));

  const find = (slug: string) => (ID.test(slug) ? projects.find((p) => p.slug === slug) : undefined);

  app.get("/", (c) => {
    // shortcut: reads every answer to count them; fine for hundreds per project, add COUNT queries if it ever gets slow.
    const rows = projects
      .map((p) => {
        const all = p.db.listResponses({});
        return { slug: p.slug, name: p.brand.name, forms: p.forms.size, answers: all.length, last: all[0]?.createdAt };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return c.html(renderProjects(lang, rows));
  });

  app.get("/p/:slug", (c) => {
    const p = find(c.req.param("slug"));
    if (!p) return notFound(c);
    const base = projectUrl(p, opts.baseDomain);
    const links = p.db.links.list().filter((l) => !l.revoked);
    const forms: FormSummary[] = [...p.forms.values()]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((def) => {
        const responses = p.db.listResponses({ formId: def.id });
        const who = new Set(responses.map((r) => r.link));
        return {
          def,
          answers: responses.length,
          url: base && `${base}/${def.id}`,
          links: links
            .filter((l) => l.formId === def.id)
            .map((l) => ({ label: l.label, url: base ? `${base}/${def.id}?k=${l.token}` : `?k=${l.token}`, answered: who.has(l.label) })),
        };
      });
    return c.html(renderForms(lang, p.slug, p.brand.name, forms));
  });

  app.get("/p/:slug/f/:form", (c) => {
    const p = find(c.req.param("slug"));
    const def = p?.forms.get(c.req.param("form"));
    if (!p || !def) return notFound(c);
    return c.html(renderAnswers(lang, { slug: p.slug, name: p.brand.name }, def, p.db.listResponses({ formId: def.id })));
  });

  app.notFound(notFound);
  return app;
}
