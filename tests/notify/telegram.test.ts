import { afterEach, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import steps from "../fixtures/steps.json";
import { parseDefinition } from "../../src/definition/schema";
import { openProjectDb } from "../../src/store/db";
import type { Project } from "../../src/projects/registry";
import { backoffMs, flushOutbox, formatAlert, queueAlert, startOutboxLoop } from "../../src/notify/telegram";

const parsed = parseDefinition(steps);
if (!parsed.ok) throw new Error(parsed.errors.join());
const def = parsed.value;

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function project(telegram: Project["telegram"] = { chatId: "42", botToken: "tok" }): Project {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qf-tg-"));
  dirs.push(dir);
  return { slug: "p", dir, domains: [], brand: { name: "P", accent: "#000" }, retentionMonths: 12, telegram, forms: new Map([[def.id, def]]), db: openProjectDb(path.join(dir, "data.sqlite")), loadErrors: [] };
}
const store = (p: Project, values = { name: "Ana" } as Record<string, any>) =>
  p.db.insertResponse({ submissionId: crypto.randomUUID(), formId: def.id, formVersion: 1, values }).id;
const T0 = new Date(Date.now() + 1000); // outbox.enqueue stamps next_at with the real clock
const min = (n: number) => new Date(T0.getTime() + n * 60_000);

test("formatAlert lists label: value in field order, multiple choices joined by ', '", () => {
  const text = formatAlert(def, { tags: ["a", "b"], contacted: true, name: "Ana", ghost: "x", color: "r" });
  expect(text.split("\n")).toEqual(["Questionnaire", "Nom : Ana", "Déjà contacté ? : Oui", "Couleur : Rouge", "Tags : A, B"]);
});

test("formatAlert is cut at 3500 characters", () => {
  expect(formatAlert(def, { name: "x".repeat(5000) }).length).toBe(3500);
});

test("send throws -> item stays, attempts+1, next_at backs off (1, 5, 30 min, then hourly)", async () => {
  expect([1, 2, 3, 4, 9].map((n) => backoffMs(n) / 60_000)).toEqual([1, 5, 30, 60, 60]);
  const p = project();
  queueAlert(p, def, store(p));
  const send = async () => {
    throw new Error("down");
  };
  let now = T0;
  for (const wait of [1, 5, 30, 60]) {
    expect(await flushOutbox(p, now, send)).toEqual({ sent: 0, failed: 1 });
    expect(p.db.outbox.due(new Date(now.getTime() + wait * 60_000 - 1))).toHaveLength(0);
    now = new Date(now.getTime() + wait * 60_000);
    expect(p.db.outbox.due(now)).toHaveLength(1);
  }
});

test("send ok -> markSent, not retried; token, chat and thread are passed", async () => {
  const p = project({ chatId: "42", threadId: 7, botToken: "tok" });
  const id = queueAlert(p, def, store(p));
  expect(id).toBe(true);
  const calls: unknown[][] = [];
  const send = async (...a: unknown[]) => void calls.push(a);
  expect(await flushOutbox(p, T0, send)).toEqual({ sent: 1, failed: 0 });
  expect(calls).toEqual([["tok", "42", "Questionnaire\nNom : Ana", 7]]);
  expect(await flushOutbox(p, min(999), send)).toEqual({ sent: 0, failed: 0 });
  expect(calls).toHaveLength(1);
});

test("project without telegram config -> nothing enqueued, flush sends nothing", async () => {
  const p = { ...project(), telegram: undefined };
  expect(queueAlert(p, def, store(p))).toBe(false);
  p.db.outbox.enqueue(1);
  let called = false;
  expect(await flushOutbox(p, min(1), async () => void (called = true))).toEqual({ sent: 0, failed: 0 });
  expect(called).toBe(false);
});

test("queueAlert respects def.notify.telegram", () => {
  const p = project();
  expect(queueAlert(p, { ...def, notify: { telegram: false } }, store(p))).toBe(false);
  expect(p.db.outbox.due(min(1))).toHaveLength(0);
});

test("purged response -> item marked sent without sending; unknown form -> field ids as labels", async () => {
  const p = project();
  p.db.outbox.enqueue(999);
  const id = store(p);
  p.db.outbox.enqueue(id);
  p.forms.clear();
  const texts: string[] = [];
  expect(await flushOutbox(p, T0, async (_t, _c, text) => void texts.push(text))).toEqual({ sent: 2, failed: 0 });
  expect(texts).toEqual(["survey\nname : Ana"]);
});

test("startOutboxLoop flushes, skips overlapping ticks, survives errors, and stops", async () => {
  const bad = project();
  bad.db.outbox.due = () => {
    throw new Error("boom");
  };
  const good = project();
  queueAlert(good, def, store(good));
  let n = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const stop = startOutboxLoop([bad, good], 5, async () => {
    n++;
    await gate;
  });
  await Bun.sleep(40);
  expect(n).toBe(1);
  release();
  await Bun.sleep(20);
  stop();
  expect(good.db.outbox.due(new Date(Date.now() + 1e9))).toHaveLength(0);
});

test("overlapping flushes of one db send each item once", async () => {
  const p = project();
  queueAlert(p, def, store(p));
  let n = 0;
  const send = async () => {
    n++;
    await Bun.sleep(30);
  };
  // A reload replaces the Project object but keeps the db: the guard must hold across both.
  const results = await Promise.all([flushOutbox(p, T0, send), flushOutbox({ ...p }, T0, send)]);
  expect(n).toBe(1);
  expect(results).toContainEqual({ sent: 0, failed: 0 });
});
