// Bundles the browser script into dist/app.js, which src/server/app.ts embeds with a text import.
import path from "node:path";

const root = path.join(import.meta.dir, "..");
const r = await Bun.build({
  entrypoints: [path.join(root, "src/client/form.ts")],
  outdir: path.join(root, "dist"),
  naming: "app.js",
  target: "browser",
  // A classic deferred script, so the exports used by the unit tests must not leak as ESM syntax.
  format: "iife",
  minify: true,
});
if (!r.success) {
  for (const log of r.logs) console.error(log);
  process.exit(1);
}
// Types the text import for tsc, which would otherwise read dist/app.js as an untyped JS module.
await Bun.write(path.join(root, "dist/app.d.ts"), "declare const js: string;\nexport default js;\n");
