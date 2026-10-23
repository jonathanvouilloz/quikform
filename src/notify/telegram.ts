import type { Field, FormDefinition } from "../definition/schema";
import type { Values } from "../definition/response";
import { t } from "../i18n/strings";
import type { Project } from "../projects/registry";
import type { ProjectDb } from "../store/db";

export type SendFn = (token: string, chatId: string, text: string, threadId?: number) => Promise<void>;

// Telegram's limit is 4096; the margin keeps the text safe whatever the encoding.
const MAX_TEXT = 3500;
const BACKOFF_MINUTES = [1, 5, 30, 60];

/** Delay before the next try, given how many sends have failed so far (1-based). */
export const backoffMs = (failures: number) => BACKOFF_MINUTES[Math.min(failures, BACKOFF_MINUTES.length) - 1]! * 60_000;

export function formatValue(def: FormDefinition, f: Field, v: Values[string]): string {
  if (typeof v === "boolean") return t(def.lang, def.address, v ? "yes" : "no");
  const label = (x: string) => f.options?.find((o) => o.value === x)?.label ?? x;
  return Array.isArray(v) ? v.map(label).join(", ") : typeof v === "string" ? label(v) : String(v);
}

const join = (title: string, lines: string[]) => [title, ...lines].join("\n").slice(0, MAX_TEXT);

export function formatAlert(def: FormDefinition, values: Values): string {
  const lines = def.steps
    .flatMap((s) => s.fields)
    .filter((f) => f.id in values)
    .map((f) => `${f.label} : ${formatValue(def, f, values[f.id]!)}`);
  return join(def.title, lines);
}

/** Enqueues an alert for a stored response; returns whether it did. */
export function queueAlert(project: Project, def: FormDefinition, responseId: number): boolean {
  if (!project.telegram || !def.notify.telegram) return false;
  project.db.outbox.enqueue(responseId);
  return true;
}

export const sendTelegram: SendFn = async (token, chatId, text, threadId) => {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...(threadId !== undefined && { message_thread_id: threadId }) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`telegram responded ${res.status}`);
};

// Keyed by db, not Project: a reload replaces the Project object but keeps its db.
const flushing = new WeakSet<ProjectDb>();

export async function flushOutbox(
  project: Project,
  now: Date,
  send: SendFn = sendTelegram,
): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  const tg = project.telegram;
  if (!tg || flushing.has(project.db)) return result;
  flushing.add(project.db);
  try {
    for (const item of project.db.outbox.due(now)) {
      const response = project.db.getResponse(item.responseId);
      if (response) {
        const def = project.forms.get(response.formId);
        const text = def
          ? formatAlert(def, response.values)
          : join(response.formId, Object.entries(response.values).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(", ") : v}`));
        try {
          await send(tg.botToken, tg.chatId, text, tg.threadId);
        } catch (e) {
          // Never log the text (personal data) or the token.
          const status = /\d{3}/.exec(e instanceof Error ? e.message : "")?.[0] ?? "error";
          console.error(`quikform: telegram alert failed (project ${project.slug}, item ${item.id}, ${status})`);
          project.db.outbox.markFailed(item.id, new Date(now.getTime() + backoffMs(item.attempts + 1)));
          result.failed++;
          continue;
        }
      }
      project.db.outbox.markSent(item.id);
      result.sent++;
    }
  } finally {
    flushing.delete(project.db);
  }
  return result;
}

export function startOutboxLoop(projects: Project[], intervalMs = 30_000, send: SendFn = sendTelegram): () => void {
  const timer = setInterval(() => {
    for (const p of projects) {
      flushOutbox(p, new Date(), send).catch((e) =>
        console.error(`quikform: outbox flush failed (project ${p.slug}): ${e instanceof Error ? e.name : "error"}`),
      );
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
