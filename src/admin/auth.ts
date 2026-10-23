import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// The password hash is part of the signature, so changing the password ends every session.
const mac = (secret: string, passwordHash: string, expiresMs: number) =>
  createHmac("sha256", secret)
    .update(`admin:${expiresMs}:${createHash("sha256").update(passwordHash).digest("hex")}`)
    .digest("hex");

export const signSession = (secret: string, passwordHash: string, expiresMs: number) =>
  `${expiresMs}.${mac(secret, passwordHash, expiresMs)}`;

export function checkSession(secret: string, passwordHash: string, cookie: string | undefined, nowMs: number): boolean {
  const m = cookie ? /^(\d{1,15})\.([0-9a-f]{64})$/.exec(cookie) : null;
  if (!m || Number(m[1]) <= nowMs) return false;
  return timingSafeEqual(Buffer.from(m[2]!), Buffer.from(mac(secret, passwordHash, Number(m[1]))));
}

// shortcut: per-IP fixed window in memory; resets on restart. Upgrade if the server ever runs on several processes.
export function createLoginLimiter(max = 10, windowMs = 15 * 60_000): (ip: string, nowMs: number) => boolean {
  const hits = new Map<string, { start: number; n: number }>();
  return (ip, nowMs) => {
    for (const [k, h] of hits) if (nowMs - h.start >= windowMs) hits.delete(k);
    const h = hits.get(ip) ?? { start: nowMs, n: 0 };
    hits.set(ip, h);
    return ++h.n > max;
  };
}
