import { test, expect } from "@playwright/test";

test("smoke: muestra pantalla de login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "La Quinta" })).toBeVisible();
  await expect(page.getByRole("button", { name: /ingresar/i })).toBeVisible();
});
