import { createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HONEYPOT, MIN_AGE_MS } from "../definition/schema";
import { validateResponse } from "../definition/response";
import { renderBrandCss, renderFormPage, renderNotFoundPage, renderThankYouPage, styles } from "../render/page";
import { resolveProject, type Project } from "../projects/registry";
import { flushOutbox, queueAlert } from "../notify/telegram";
import { createAdmin, type AdminConfig } from "../admin/routes";
import { ADMIN_JS } from "../admin/pages";
// Built by scripts/build-client.ts (the test preload runs it); the text import embeds it in the compiled binary.
import clientJs from "../../dist/app.js" with { type: "text" };
// File imports give a path that --compile embeds in the binary.
import latin from "../render/fonts/plus-jakarta-sans-latin-wght-normal.woff2" with { type: "file" };
import latinExt from "../render/fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2" with { type: "file" };

// Keyed by the names styles.css uses; the compiled binary renames the embedded files.
const FONTS = new Map([["plus-jakarta-sans-latin-wght-normal.woff2", latin], ["plus-jakarta-sans-latin-ext-wght-normal.woff2", latinExt]]);

const CSP = "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
// A logo opened directly must not run script, which an SVG could carry.
const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
const IMAGE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };
const RATE_MAX = 10;
const RATE_WINDOW_MS = 10 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createApp(opts: { projects: Project[]; secret: string; now?: () => Date; baseDomain?: string; admin?: AdminConfig }): Hono {
  const { projects, secret, baseDomain } = opts;
  const project = (host: string | undefined) => resolveProject(projects, host ?? "", baseDomain);
  const now = opts.now ?? (() => new Date());
  const app = new Hono();
  // shortcut: fixed window per IP, in memory; resets on restart. Upgrade if the server ever runs on several processes.
  const hits = new Map<string, { start: number; n: number }>();

  const mac = (ms: number) => createHmac("sha256", secret).update(String(ms)).digest("hex");
  const stamp = () => {
    const ms = now().getTime();
    return `${ms}.${mac(ms)}`;
  };
  // A stamp is valid when signed by us and at least MIN_AGE_MS old (future stamps are rejected too).
  const stampOk = (v: unknown) => {
    const m = typeof v === "string" ? /^(\d{1,15})\.([0-9a-f]{64})$/.exec(v) : null;
    if (!m) return false;
    const a = Buffer.from(m[2]!);
    const b = Buffer.from(mac(Number(m[1])));
    return a.length === b.length && timingSafeEqual(a, b) && now().getTime() - Number(m[1]) >= MIN_AGE_MS;
  };
  const limited = (ip: string) => {
    const t = now().getTime();
    for (const [k, h] of hits) if (t - h.start >= RATE_WINDOW_MS) hits.delete(k);
    const h = hits.get(ip) ?? { start: t, n: 0 };
    hits.set(ip, h);
    return ++h.n > RATE_MAX;
  };
  const clientIp = (c: Context) => c.req.header("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";

  const notFound = (c: Context) => c.html(renderNotFoundPage(), 404);
  const page = (c: Context, html: string, status: 200 | 422 = 200) => {
    c.header("Cache-Control", "no-store");
    return c.html(html, status);
  };
  // A private form exists only for a live token of that same form; anything else is the plain 404.
  const lookup = (c: Context, token = c.req.query("k")) => {
    const p = project(c.req.header("host"));
    const def = p?.forms.get(c.req.param("form") ?? "");
    if (!p || !def) return undefined;
    if (def.access === "public") return { project: p, def };
    const link = token ? p.db.links.find(token) : undefined;
    return link?.formId === def.id ? { project: p, def, token: token!, link: link.label } : undefined;
  };

  app.use(async (c, next) => {
    await next();
    if (!c.res.headers.has("Content-Security-Policy")) c.header("Content-Security-Policy", CSP);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "same-origin");
  });
  app.notFound(notFound);

  // The admin host serves only the admin (plus the shared /_qf/ assets); without admin settings it does not exist.
  if (opts.admin) {
    const host = opts.admin.host;
    const admin = createAdmin({ config: opts.admin, projects, secret, baseDomain, now, clientIp });
    app.use(async (c, next) => {
      const name = (c.req.header("host") ?? "").toLowerCase().replace(/:\d+$/, "");
      if (name !== host || c.req.path.startsWith("/_qf/")) return next();
      c.res = await admin.fetch(c.req.raw);
    });
  }
  app.get("/_qf/admin.js", (c) => c.body(ADMIN_JS, 200, { "Content-Type": "application/javascript; charset=utf-8" }));

  app.get("/_qf/app.css", (c) => c.body(styles, 200, { "Content-Type": "text/css; charset=utf-8" }));
  app.get("/_qf/app.js", (c) => c.body(clientJs, 200, { "Content-Type": "application/javascript; charset=utf-8" }));
  app.get("/_qf/fonts/:file", async (c) => {
    const f = FONTS.get(c.req.param("file"));
    if (!f) return notFound(c);
    return c.body(await Bun.file(f).bytes(), 200, { "Content-Type": "font/woff2", "Cache-Control": "public, max-age=31536000, immutable" });
  });
  app.get("/_qf/logo", async (c) => {
    const p = project(c.req.header("host"));
    const logo = p?.brand.logo;
    if (!p || !logo) return notFound(c);
    // The name was checked on load (plain file name, image extension); the file may have gone since.
    const file = Bun.file(path.join(p.dir, logo));
    if (!(await file.exists())) return notFound(c);
    const type = IMAGE_TYPES[logo.split(".").pop()!.toLowerCase()]!;
    const headers: Record<string, string> = { "Content-Type": type, "Cache-Control": "public, max-age=3600" };
    if (type === "image/svg+xml") headers["Content-Security-Policy"] = SVG_CSP;
    return c.body(await file.bytes(), 200, headers);
  });
  app.get("/_qf/brand.css", (c) => {
    const p = project(c.req.header("host"));
    return p ? c.body(renderBrandCss(p.brand), 200, { "Content-Type": "text/css; charset=utf-8" }) : notFound(c);
  });

  // Caddy's on-demand TLS asks here before getting a certificate, so unknown names never get one.
  app.get("/_qf/tls", (c) => {
    const domain = c.req.query("domain")?.toLowerCase();
    return project(domain) || (opts.admin && domain === opts.admin.host) ? c.text("ok") : notFound(c);
  });

  app.get("/:form", (c) => {
    const r = lookup(c);
    return r ? page(c, renderFormPage({ def: r.def, brand: r.project.brand, submissionId: crypto.randomUUID(), timestamp: stamp(), linkToken: r.token })) : notFound(c);
  });

  app.get("/:form/thanks", (c) => {
    const r = lookup(c);
    return r ? page(c, renderThankYouPage(r.def, r.project.brand)) : notFound(c);
  });

  app.post("/:form", bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.text("Payload Too Large", 413) }), async (c) => {
    // Token checked first, from the URL (the form posts to its own page): a private form must not answer 400 or 429 to strangers.
    const r = lookup(c);
    if (!r) return notFound(c);
    if (limited(clientIp(c))) return c.text("Too Many Requests", 429);
    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody({ all: true });
    } catch {
      return c.text("Bad Request", 400);
    }
    const raw: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(body)) {
      const strings = [v].flat().filter((x): x is string => typeof x === "string"); // drops File values
      if (strings.length) raw[k] = Array.isArray(v) ? strings : strings[0]!;
    }
    if (r.token && raw._k !== r.token) return notFound(c);
    // Built on return only: c.redirect sets Location on the shared context.
    const thanks = () => c.redirect(`/${r.def.id}/thanks${r.token ? `?k=${encodeURIComponent(r.token)}` : ""}`, 303);
    if (raw[HONEYPOT] || !stampOk(raw._t)) return thanks();

    const v = validateResponse(r.def, raw);
    const sid = typeof raw._sid === "string" && UUID.test(raw._sid) ? raw._sid : crypto.randomUUID();
    if (!v.ok) {
      return page(c, renderFormPage({ def: r.def, brand: r.project.brand, values: raw, errors: v.errors, submissionId: sid, timestamp: stamp(), linkToken: r.token }), 422);
    }
    const { inserted, id } = r.project.db.insertResponse({ submissionId: sid, formId: r.def.id, formVersion: r.def.version, values: v.values, link: r.link });
    if (inserted && queueAlert(r.project, r.def, id)) {
      flushOutbox(r.project, now()).catch(() => console.error(`quikform: outbox flush failed (project ${r.project.slug})`));
    }
    return thanks();
  });

  return app;
}
