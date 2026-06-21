import type { Page } from "playwright/test";

export async function loginAsPatient(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /sign in with email \+ password/i }).click();
  await page.waitForURL(/\/(dashboard|cases)\//, { timeout: 30_000 });
}
