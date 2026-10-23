// e2e server: the demo project in a fresh temporary QUIKFORM home, on the port Playwright picked.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadProjects } from "../src/projects/registry";
import { createApp } from "../src/server/app";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "qf-e2e-"));
fs.cpSync(path.join(import.meta.dir, "../examples/demo"), path.join(home, "projects/demo"), { recursive: true });
const projects = loadProjects(home);
const app = createApp({ projects, secret: "e2e-secret" });
const demo = projects[0]!;
process.on("exit", () => fs.rmSync(home, { recursive: true, force: true }));
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

Bun.serve({
  port: Number(process.env.QF_E2E_PORT),
  hostname: "localhost",
  // Test-only window on the store, so the spec can tell a stored answer from a silent spam redirect.
  fetch: (req) =>
    new URL(req.url).pathname === "/__e2e/responses" ? Response.json(demo.db.listResponses({})) : app.fetch(req),
});
