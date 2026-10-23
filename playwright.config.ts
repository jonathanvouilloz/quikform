import net from "node:net";
import { defineConfig, devices } from "@playwright/test";

// Picked once in the main process; workers inherit the variable and reuse it.
process.env.QF_E2E_PORT ??= String(
  await new Promise<number>((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  }),
);
const url = `http://localhost:${process.env.QF_E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  use: { ...devices["Desktop Chrome"], baseURL: url, viewport: { width: 390, height: 844 } },
  webServer: { command: "bun scripts/build-client.ts && bun e2e/serve.ts", url: `${url}/_qf/app.css`, reuseExistingServer: false },
});
