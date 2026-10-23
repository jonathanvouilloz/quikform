import { Database } from "bun:sqlite";
import { randomBytes } from "node:crypto";
import type { Values } from "../definition/response";

export type StoredResponse = {
  id: number;
  submissionId: string;
  formId: string;
  formVersion: number;
  values: Values;
  createdAt: Date;
  link?: string;
};
export type OutboxItem = { id: number; responseId: number; attempts: number };
export type NewResponse = {
  submissionId: string;
  formId: string;
  formVersion: number;
  values: Values;
  createdAt?: Date;
  link?: string;
};
export type Link = { token: string; formId: string; label: string; createdAt: Date; revoked: boolean };
export type ProjectDb = {
  insertResponse(r: NewResponse): { inserted: boolean; id: number };
  getResponse(id: number): StoredResponse | undefined;
  listResponses(q: { formId?: string; limit?: number }): StoredResponse[];
  purgeOlderThan(date: Date): number;
  close(): void;
  links: {
    create(formId: string, label: string): string;
    find(token: string): { formId: string; label: string } | undefined;
    list(formId?: string): Link[];
    revoke(token: string): boolean;
  };
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
  link: string | null;
};
const toResponse = (r: Row): StoredResponse => ({
  id: r.id,
  submissionId: r.submission_id,
  formId: r.form_id,
  formVersion: r.form_version,
  values: JSON.parse(r.values_json),
  createdAt: new Date(r.created_at),
  ...(r.link === null ? {} : { link: r.link }),
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
  // Added with private links: older databases get the column on open.
  if (!(db.query("PRAGMA table_info(responses)").all() as { name: string }[]).some((c) => c.name === "link")) {
    db.run("ALTER TABLE responses ADD COLUMN link TEXT");
  }
  // shortcut: tokens stored in plain text so links can be listed again; whoever reads this file already reads the answers. Hash them if links ever grant more than answering.
  db.run(`CREATE TABLE IF NOT EXISTS links (
    token TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
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
    `INSERT INTO responses (submission_id, form_id, form_version, values_json, created_at, link)
     VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(submission_id) DO NOTHING`,
  );
  const linkInsert = db.query("INSERT INTO links (token, form_id, label, created_at) VALUES (?, ?, ?, ?)");
  const linkFind = db.query("SELECT form_id AS formId, label FROM links WHERE token = ? AND revoked_at IS NULL");
  const linkList = db.query("SELECT * FROM links WHERE (?1 IS NULL OR form_id = ?1) ORDER BY created_at, rowid");
  const linkRevoke = db.query("UPDATE links SET revoked_at = ? WHERE token = ? AND revoked_at IS NULL");
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
        r.link ?? null,
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
    links: {
      create(formId, label) {
        const token = randomBytes(24).toString("base64url");
        linkInsert.run(token, formId, label, Date.now());
        return token;
      },
      find: (token) => (linkFind.get(token) as { formId: string; label: string } | null) ?? undefined,
      list: (formId) =>
        (linkList.all(formId ?? null) as { token: string; form_id: string; label: string; created_at: number; revoked_at: number | null }[]).map((l) => ({
          token: l.token, formId: l.form_id, label: l.label, createdAt: new Date(l.created_at), revoked: l.revoked_at !== null,
        })),
      revoke: (token) => linkRevoke.run(Date.now(), token).changes > 0,
    },
    outbox: {
      enqueue: (responseId) => void enqueue.run(responseId, Date.now()),
      due: (now) => due.all(now.getTime()) as OutboxItem[],
      markSent: (id) => void sent.run(Date.now(), id),
      markFailed: (id, nextAt) => void failed.run(nextAt.getTime(), id),
    },
  };
}
