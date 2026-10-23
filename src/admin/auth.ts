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

// IPv6: one attacker usually holds a whole /64, so the /64 is the unit counted.
export function ipKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  // An embedded IPv4 (::ffff:1.2.3.4) counts as two hextets.
  const v4 = (h: string) => {
    const [a = 0, b = 0, c = 0, d = 0] = h.split(".").map(Number);
    return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)];
  };
  const hextets = (part: string) => (part ? part.split(":").flatMap((h) => (h.includes(".") ? v4(h) : [h])) : []);
  const [head = "", tail] = ip.split("::");
  const left = hextets(head);
  const right = tail === undefined ? [] : hextets(tail);
  const all = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return all.slice(0, 4).map((h) => parseInt(h, 16).toString(16)).join(":") + "::/64";
}

// shortcut: fixed windows in memory, reset on restart; upgrade if the server ever runs on several processes.
// Only failures count: 10 per IP (or IPv6 /64), and 50 across all IPs, which also bounds the map and the CPU spent on argon2.
export function createLoginLimiter(perIp = 10, global = 50, windowMs = 15 * 60_000) {
  const fails = new Map<string, { start: number; n: number }>();
  let all = { start: 0, n: 0 };
  const sweep = (nowMs: number) => {
    for (const [k, h] of fails) if (nowMs - h.start >= windowMs) fails.delete(k);
    if (nowMs - all.start >= windowMs) all = { start: nowMs, n: 0 };
  };
  return {
    blocked(ip: string, nowMs: number): boolean {
      sweep(nowMs);
      return all.n >= global || (fails.get(ipKey(ip))?.n ?? 0) >= perIp;
    },
    fail(ip: string, nowMs: number): void {
      sweep(nowMs);
      const k = ipKey(ip);
      const h = fails.get(k) ?? { start: nowMs, n: 0 };
      fails.set(k, h);
      h.n++;
      all.n++;
    },
  };
}
