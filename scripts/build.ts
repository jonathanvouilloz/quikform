// Client bundle first (the server embeds it), then the single executable.
import path from "node:path";

const root = path.join(import.meta.dir, "..");
for (const cmd of [["bun", "scripts/build-client.ts"], ["bun", "build", "--compile", "src/cli/main.ts", "--outfile", "dist/quikform"]]) {
  const r = Bun.spawnSync(cmd, { cwd: root, stdout: "inherit", stderr: "inherit" });
  if (r.exitCode !== 0) process.exit(r.exitCode ?? 1);
}
