import { Database } from "bun:sqlite";
import type { Values } from "../definition/response";

export type StoredResponse = {
  id: number;
  submissionId: string;
  formId: string;
  formVersion: number;
  values: Values;
  createdAt: Date;
};
export type OutboxItem = { id: number; responseId: number; attempts: number };
export type NewResponse = {
  submissionId: string;
  formId: string;
  formVersion: number;
  values: Values;
  createdAt?: Date;
};
export type ProjectDb = {
  insertResponse(r: NewResponse): { inserted: boolean; id: number };
  getResponse(id: number): StoredResponse | undefined;
  listResponses(q: { formId?: string; limit?: number }): StoredResponse[];
  purgeOlderThan(date: Date): number;
  close(): void;
  outbox: {
    enqueue(responseId: number): void;
    due(now: Date): OutboxItem[];
    markSent(id: number): void;
    markFailed(id: number, nextAt: Date): void;
  };
};

type Row = {
  id: number;
  submission_id: string;
  form_id: string;
  form_version: number;
  values_json: string;
  created_at: number;
};
const toResponse = (r: Row): StoredResponse => ({
  id: r.id,
  submissionId: r.submission_id,
  formId: r.form_id,
  formVersion: r.form_version,
  values: JSON.parse(r.values_json),
  createdAt: new Date(r.created_at),
});

/** `months` before `now`, the day clamped to the target month's length (Mar 31 - 1 month = Feb 28 or 29). */
export function cutoff(now: Date, months: number): Date {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(now.getUTCDate(), days));
  return d;
}

// Timestamps are stored as integer milliseconds since the epoch (UTC).
export function openProjectDb(path: string): ProjectDb {
  const db = new Database(path);
  // Timeout first: switching to WAL itself needs a lock another process may hold.
  db.run("PRAGMA busy_timeout = 5000");
  db.run("PRAGMA journal_mode = WAL");
  db.run(`CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY,
    submission_id TEXT NOT NULL UNIQUE,
    form_id TEXT NOT NULL,
    form_version INTEGER NOT NULL,
    values_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  db.run("CREATE INDEX IF NOT EXISTS responses_created_at ON responses (created_at)");
  db.run(`CREATE TABLE IF NOT EXISTS telegram_outbox (
    id INTEGER PRIMARY KEY,
    response_id INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_at INTEGER NOT NULL,
    sent_at INTEGER
  )`);

  const insert = db.query(
    `INSERT INTO responses (submission_id, form_id, form_version, values_json, created_at)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT(submission_id) DO NOTHING`,
  );
  const idOf = db.query("SELECT id FROM responses WHERE submission_id = ?");
  const get = db.query("SELECT * FROM responses WHERE id = ?");
  const list = db.query(
    "SELECT * FROM responses WHERE (?1 IS NULL OR form_id = ?1) ORDER BY id DESC LIMIT ?2",
  );
  const purgeOutbox = db.query(
    "DELETE FROM telegram_outbox WHERE response_id IN (SELECT id FROM responses WHERE created_at < ?)",
  );
  const purge = db.query("DELETE FROM responses WHERE created_at < ?");
  const enqueue = db.query("INSERT INTO telegram_outbox (response_id, next_at) VALUES (?, ?)");
  const due = db.query(
    "SELECT id, response_id AS responseId, attempts FROM telegram_outbox WHERE sent_at IS NULL AND next_at <= ? ORDER BY id",
  );
  const sent = db.query("UPDATE telegram_outbox SET sent_at = ? WHERE id = ?");
  const failed = db.query("UPDATE telegram_outbox SET attempts = attempts + 1, next_at = ? WHERE id = ?");
  const purgeAll = db.transaction((ms: number) => {
    purgeOutbox.run(ms);
    return purge.run(ms).changes;
  });

  return {
    insertResponse(r) {
      const res = insert.run(
        r.submissionId,
        r.formId,
        r.formVersion,
        JSON.stringify(r.values),
        (r.createdAt ?? new Date()).getTime(),
      );
      if (res.changes > 0) return { inserted: true, id: Number(res.lastInsertRowid) };
      return { inserted: false, id: (idOf.get(r.submissionId) as { id: number }).id };
    },
    getResponse(id) {
      const row = get.get(id) as Row | null;
      return row ? toResponse(row) : undefined;
    },
    listResponses({ formId, limit }) {
      return (list.all(formId ?? null, limit ?? -1) as Row[]).map(toResponse);
    },
    purgeOlderThan: (date) => purgeAll(date.getTime()),
    close: () => db.close(),
    outbox: {
      enqueue: (responseId) => void enqueue.run(responseId, Date.now()),
      due: (now) => due.all(now.getTime()) as OutboxItem[],
      markSent: (id) => void sent.run(Date.now(), id),
      markFailed: (id, nextAt) => void failed.run(nextAt.getTime(), id),
    },
  };
}
