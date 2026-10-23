import { expect, test } from "bun:test";
import { checkSession, createLoginLimiter, signSession } from "../../src/admin/auth";

const SECRET = "s".repeat(40);
const HASH = "$argon2id$v=19$m=65536,t=2,p=1$abc$def";
const NOW = 1_800_000_000_000;

test("a signed session is valid until it expires", () => {
  const c = signSession(SECRET, HASH, NOW + 1000);
  expect(checkSession(SECRET, HASH, c, NOW)).toBe(true);
  expect(checkSession(SECRET, HASH, c, NOW + 1000)).toBe(false);
});

test("a tampered, foreign or malformed session is refused", () => {
  const c = signSession(SECRET, HASH, NOW + 1000);
  const [exp, mac] = c.split(".");
  expect(checkSession(SECRET, HASH, `${Number(exp) + 1}.${mac}`, NOW)).toBe(false);
  expect(checkSession("t".repeat(40), HASH, c, NOW)).toBe(false);
  expect(checkSession(SECRET, HASH + "x", c, NOW)).toBe(false); // password changed
  for (const bad of [undefined, "", "abc", `${exp}.`, `.${mac}`, `${exp}.${mac}x`]) expect(checkSession(SECRET, HASH, bad, NOW)).toBe(false);
});

test("the login limiter blocks the 11th try in 15 minutes per IP, then frees it", () => {
  const blocked = createLoginLimiter();
  for (let i = 0; i < 10; i++) expect(blocked("1.1.1.1", NOW)).toBe(false);
  expect(blocked("1.1.1.1", NOW)).toBe(true);
  expect(blocked("2.2.2.2", NOW)).toBe(false);
  expect(blocked("1.1.1.1", NOW + 15 * 60_000)).toBe(false);
});
