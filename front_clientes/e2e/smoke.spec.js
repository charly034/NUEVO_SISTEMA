import { test, expect } from "@playwright/test";

test("smoke: muestra onboarding y permite llegar al login", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /viandas de la semana/i })).toBeVisible();
  await page.getByRole("button", { name: /omitir/i }).click();

  await expect(page.getByRole("button", { name: /iniciar sesi/i })).toBeVisible();
});
