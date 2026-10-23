import { expect, test } from "bun:test";
import { t, type StringKey } from "../../src/i18n/strings";

const KEYS: StringKey[] = ["required", "invalidEmail", "number", "min", "max", "maxLength", "chooseOne", "next", "back", "submit", "stepOf", "errorSummary", "draftRestored", "yes", "no", "optional", "sending", "notFound"];

test("every StringKey exists in fr, en, de, th, formal and informal", () => {
  for (const lang of ["fr", "en", "de", "th"] as const)
    for (const address of ["formal", "informal"] as const)
      for (const key of KEYS) expect(t(lang, address, key, { min: 1, max: 2, current: 1, total: 2 }).length).toBeGreaterThan(0);
});

test("fr formal vs informal and variables", () => {
  expect(t("fr", "formal", "invalidEmail")).toBe("Vérifiez votre adresse email.");
  expect(t("fr", "informal", "invalidEmail")).toBe("Vérifie ton adresse email.");
  expect(t("fr", "formal", "stepOf", { current: 2, total: 5 })).toBe("Étape 2 sur 5");
  expect(t("fr", "formal", "errorSummary")).toContain("\u202f:");
});

test("no exclamation marks anywhere", () => {
  for (const lang of ["fr", "en", "de", "th"] as const)
    for (const key of KEYS) expect(t(lang, "informal", key)).not.toContain("!");
});
