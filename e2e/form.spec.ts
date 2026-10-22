import { expect, test, type Page } from "@playwright/test";

const responses = async (page: Page) => (await page.request.get("/__e2e/responses")).json();

test("keyboard only on a phone: steps, showIf, draft after reload, submit", async ({ page }) => {
  await page.goto("/demo");
  const step = page.locator(".qf-stepof");
  await expect(step).toHaveText("Étape 1 sur 3");
  await expect(page.locator("[data-step='1']")).toBeHidden();
  await expect(page.locator("progress.qf-progress")).toBeVisible();

  // "Suivant" on an empty step shows the error and focuses the first invalid field.
  await page.keyboard.press("Tab");
  await expect(page.locator("#name")).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.locator("#name\\:error")).toHaveText("Ce champ est requis.");
  await expect(page.locator("#name")).toBeFocused();
  await expect(step).toHaveText("Étape 1 sur 3");

  await page.keyboard.type("Ana");
  await expect(page.locator("#name\\:error")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.locator("#email")).toBeFocused();
  await page.keyboard.type("ana@example");
  await page.keyboard.press("Tab"); // leaving the field turns on live validation
  await expect(page.locator("#email\\:error")).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("End");
  await page.keyboard.type(".com");
  await expect(page.locator("#email\\:error")).toHaveCount(0);
  await page.keyboard.press("Enter");

  await expect(step).toHaveText("Étape 2 sur 3");
  await expect(page.locator("#kind\\:0")).toBeFocused();
  await page.keyboard.press("b");
  await expect(page.locator("#kind\\:1")).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(page.locator("#has_deadline\\:0")).toBeFocused();
  await expect(page.locator("[data-field='deadline']")).toBeHidden();
  await page.keyboard.press("a");
  await expect(page.locator("[data-field='deadline']")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#deadline")).toBeFocused();
  await page.keyboard.type("En juin");
  await page.keyboard.press("Enter");
  await page.keyboard.type("5000");

  await page.reload();
  await expect(page.locator(".qf-draft")).toHaveText("Votre brouillon a été restauré.");
  await expect(step).toHaveText("Étape 2 sur 3");
  await expect(page.locator("#budget")).toHaveValue("5000");
  await expect(page.locator("#deadline")).toHaveValue("En juin");
  const loaded = Date.now();

  await page.keyboard.press("Tab");
  await expect(page.locator("#kind\\:1")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#has_deadline\\:0")).toBeChecked();
  await page.keyboard.press("b"); // "Non" hides the deadline again
  await expect(page.locator("[data-field='deadline']")).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(page.locator("#budget")).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(step).toHaveText("Étape 3 sur 3");
  await expect(page.locator("#channels\\:0")).toBeFocused();
  await page.keyboard.press("a");
  await page.keyboard.press("c");
  await page.keyboard.press("a");
  await expect(page.locator("#channels\\:0")).not.toBeChecked();
  await expect(page.locator("#channels\\:2")).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(page.locator("#details")).toBeFocused();
  await page.keyboard.type("Ligne 1");
  await page.keyboard.press("Enter"); // a new line, not the next field
  await page.keyboard.type("Ligne 2");
  await expect(page.locator("#details")).toHaveValue("Ligne 1\nLigne 2");
  await page.keyboard.press("Tab");
  await expect(page.locator(".qf-submit[type='submit']")).toBeFocused();

  // The server ignores answers sent less than 3 s after the page was served.
  await page.waitForTimeout(Math.max(0, 3200 - (Date.now() - loaded)));
  // The page is gone as soon as the POST navigates, so a listener added after the client's records the button state.
  await page.evaluate(() =>
    document.querySelector("form")!.addEventListener("submit", () => {
      const b = document.querySelector<HTMLButtonElement>(".qf-submit[type='submit']")!;
      sessionStorage.setItem("qf-e2e-submit", JSON.stringify([b.disabled, b.textContent]));
    }),
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/demo\/thanks$/);
  await expect(page.locator("h1")).toHaveText("Merci");
  expect(await page.evaluate(() => sessionStorage.getItem("qf-e2e-submit"))).toBe(JSON.stringify([true, "Envoi en cours…"]));

  const [stored] = await responses(page);
  expect(stored.values).toEqual({
    name: "Ana",
    email: "ana@example.com",
    kind: "shop",
    has_deadline: false,
    budget: 5000,
    channels: ["social"],
    details: "Ligne 1\r\nLigne 2", // form submission sends textarea newlines as CRLF
  });

  await page.goto("/demo");
  await expect(page.locator(".qf-draft")).toHaveCount(0);
  await expect(page.locator("#name")).toHaveValue("");
});

test("a click that leaves an invalid field still lands, even though the error moves the layout", async ({ page }) => {
  await page.goto("/demo");
  await page.fill("#name", "Ana");
  await page.fill("#email", "ana@example.com");
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.locator("#kind\\:0")).toBeFocused(); // empty and required: leaving it shows an error above
  await page.locator("label[for='has_deadline:0']").click();
  await expect(page.locator("#has_deadline\\:0")).toBeChecked();
  await expect(page.locator("#kind\\:error")).toHaveText("Ce champ est requis.");
  await expect(page.locator("[data-field='deadline']")).toBeVisible();
});
