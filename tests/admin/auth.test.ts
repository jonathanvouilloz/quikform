import { expect, test } from "bun:test";
import { checkSession, createLoginLimiter, ipKey, signSession } from "../../src/admin/auth";

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

test("the limiter counts failures only: 10 per IP in 15 minutes, then frees it", () => {
  const l = createLoginLimiter();
  for (let i = 0; i < 10; i++) {
    expect(l.blocked("1.1.1.1", NOW)).toBe(false);
    l.fail("1.1.1.1", NOW);
  }
  expect(l.blocked("1.1.1.1", NOW)).toBe(true);
  expect(l.blocked("2.2.2.2", NOW)).toBe(false);
  expect(l.blocked("1.1.1.1", NOW + 15 * 60_000)).toBe(false);
  const ok = createLoginLimiter();
  for (let i = 0; i < 20; i++) expect(ok.blocked("3.3.3.3", NOW)).toBe(false); // checks without failures never block
});

test("IPv6 addresses of one /64 share a counter", () => {
  expect(ipKey("2a02:4780:79:fe7e::1")).toBe(ipKey("2a02:4780:79:fe7e:ffff:1:2:3"));
  expect(ipKey("2a02:4780:79:fe7e::1")).not.toBe(ipKey("2a02:4780:79:fe7f::1"));
  expect(ipKey("::ffff:1.2.3.4")).toBe(ipKey("::ffff:1.2.3.5")); // shortcut accepted: mapped IPv4 behind one proxy is rare
  expect(ipKey("1.2.3.4")).toBe("1.2.3.4");
  const l = createLoginLimiter();
  for (let i = 0; i < 10; i++) l.fail(`2a02:4780:79:fe7e::${i + 1}`, NOW);
  expect(l.blocked("2a02:4780:79:fe7e:aaaa::9", NOW)).toBe(true);
});

test("50 failures in 15 minutes across all IPs block every sign-in", () => {
  const l = createLoginLimiter();
  for (let i = 0; i < 50; i++) l.fail(`10.0.${i}.1`, NOW);
  expect(l.blocked("9.9.9.9", NOW)).toBe(true);
  expect(l.blocked("9.9.9.9", NOW + 15 * 60_000)).toBe(false);
});
