import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cutoff, openProjectDb } from "../../src/store/db";

const dirs: string[] = [];
function tmpDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qf-db-"));
  dirs.push(dir);
  return path.join(dir, "data.sqlite");
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const base = { formId: "contact", formVersion: 1, values: { name: "a" } };

test("same submissionId twice -> second insert returns inserted:false, one row", () => {
  const db = openProjectDb(tmpDb());
  const a = db.insertResponse({ ...base, submissionId: "s1" });
  const b = db.insertResponse({ ...base, submissionId: "s1" });
  expect(a.inserted).toBe(true);
  expect(b).toEqual({ inserted: false, id: a.id });
  expect(db.listResponses({})).toHaveLength(1);
});

test("values JSON round-trips Thai text", () => {
  const db = openProjectDb(tmpDb());
  const values = { name: "สวัสดีครับ", tags: ["ก", "ข"], n: 3, ok: true };
  const { id } = db.insertResponse({ ...base, submissionId: "s1", values });
  expect(db.getResponse(id)?.values).toEqual(values);
  expect(db.listResponses({ formId: "contact" })[0]?.values).toEqual(values);
  expect(db.getResponse(999)).toBeUndefined();
});

test("purgeOlderThan deletes only older rows and their outbox rows, returns the count", () => {
  const db = openProjectDb(tmpDb());
  const old = db.insertResponse({ ...base, submissionId: "old", createdAt: new Date("2024-01-01") });
  db.insertResponse({ ...base, submissionId: "new", createdAt: new Date("2026-01-01") });
  db.outbox.enqueue(old.id);
  expect(db.purgeOlderThan(new Date("2025-01-01"))).toBe(1);
  expect(db.listResponses({}).map((r) => r.submissionId)).toEqual(["new"]);
  expect(db.outbox.due(new Date("2030-01-01"))).toEqual([]);
});

test("WAL mode on, schema created once (idempotent open)", () => {
  const p = tmpDb();
  const db = openProjectDb(p);
  db.insertResponse({ ...base, submissionId: "s1" });
  const again = openProjectDb(p);
  expect(again.listResponses({})).toHaveLength(1);
  const raw = new Database(p, { readonly: true });
  expect((raw.query("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toBe("wal");
  raw.close();
});

test("outbox: due, markFailed reschedules with attempts, markSent removes", () => {
  const db = openProjectDb(tmpDb());
  const { id } = db.insertResponse({ ...base, submissionId: "s1" });
  db.outbox.enqueue(id);
  const now = new Date(Date.now() + 1000);
  const [item] = db.outbox.due(now);
  expect(item).toMatchObject({ responseId: id, attempts: 0 });
  db.outbox.markFailed(item!.id, new Date(now.getTime() + 3600_000));
  expect(db.outbox.due(now)).toEqual([]);
  const [retry] = db.outbox.due(new Date(now.getTime() + 3600_000));
  expect(retry?.attempts).toBe(1);
  db.outbox.markSent(item!.id);
  expect(db.outbox.due(new Date("2030-01-01"))).toEqual([]);
});

test("cutoff goes back whole months and clamps the day at month end", () => {
  const at = (s: string) => new Date(`${s}T10:00:00Z`);
  expect(cutoff(at("2026-10-22"), 12)).toEqual(at("2025-10-22"));
  expect(cutoff(at("2026-03-31"), 1)).toEqual(at("2026-02-28"));
  expect(cutoff(at("2028-03-31"), 1)).toEqual(at("2028-02-29"));
  expect(cutoff(at("2026-01-31"), 2)).toEqual(at("2025-11-30"));
});

test("links: create gives a 32-char base64url token, find until revoked, list shows both", () => {
  const db = openProjectDb(tmpDb());
  const t = db.links.create("contact", "Olivier");
  expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(db.links.find(t)).toEqual({ formId: "contact", label: "Olivier" });
  const u = db.links.create("other", "Anne");
  expect(db.links.revoke(t)).toBe(true);
  expect(db.links.revoke("nope")).toBe(false);
  expect(db.links.find(t)).toBeUndefined();
  expect(db.links.list().map((l) => [l.label, l.revoked])).toEqual([["Olivier", true], ["Anne", false]]);
  expect(db.links.list("other").map((l) => l.token)).toEqual([u]);
});

test("a response keeps its link label; a pre-links database opens and migrates without loss", () => {
  const file = tmpDb();
  const old = new Database(file);
  old.run(`CREATE TABLE responses (id INTEGER PRIMARY KEY, submission_id TEXT NOT NULL UNIQUE, form_id TEXT NOT NULL,
    form_version INTEGER NOT NULL, values_json TEXT NOT NULL, created_at INTEGER NOT NULL)`);
  old.run(`INSERT INTO responses (submission_id, form_id, form_version, values_json, created_at) VALUES ('s0', 'contact', 1, '{"name":"old"}', 1)`);
  old.close();
  const db = openProjectDb(file);
  db.insertResponse({ ...base, submissionId: "s1", link: "Olivier" });
  const [a, b] = db.listResponses({});
  expect([a!.link, b!.values, b!.link]).toEqual(["Olivier", { name: "old" }, undefined]);
  db.close();
  expect(() => openProjectDb(file).close()).not.toThrow(); // second open: column already there
});
