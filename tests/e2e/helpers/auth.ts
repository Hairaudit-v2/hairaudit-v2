import type { Page } from "playwright/test";

export async function loginAsPatient(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in with email \+ password/i }).click();
  await page.waitForURL(/\/(dashboard|cases)\//, { timeout: 45_000 });
}

export async function loginAsAuditor(page: Page, email: string, password: string): Promise<void> {
  // `/login/auditor` only accepts auditor@hairaudit.com.
  // Demo QA auditor (auditor-demo@hairaudit.test) signs in via the standard login
  // with profiles.role=auditor.
  await page.goto("/login");
  await page.locator("#email").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in with email \+ password/i }).click();
  await page.waitForURL(/\/(dashboard|cases)\//, { timeout: 45_000 });
}

/** Clear auth cookies + web storage so a subsequent role login is clean. */
export async function clearAuthState(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
}
