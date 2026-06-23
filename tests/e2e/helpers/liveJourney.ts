import type { Page } from "playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tryCreateSupabaseAdminClient } from "../../../src/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "./env";

export function liveJourneyBlockedReason(): string | null {
  if (!hasSupabaseAdminEnv()) {
    return "Missing Supabase env. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local (repo root), then re-run.";
  }
  return null;
}

export const LIVE_JOURNEY_PASSWORD = "HairAudit-E2E-Live-2026!";

export async function createEphemeralPatientUser(admin: SupabaseClient): Promise<{
  userId: string;
  email: string;
  password: string;
} | null> {
  const stamp = Date.now();
  const email = `e2e-live-journey-${stamp}@hairaudit.test`;
  const password = LIVE_JOURNEY_PASSWORD;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "patient" },
  });

  if (error || !data.user?.id) {
    console.error("[liveJourney] createUser failed", error?.message);
    return null;
  }

  await admin.from("profiles").upsert({
    id: data.user.id,
    role: "patient",
    email,
    name: "E2E Live Journey",
  });

  return { userId: data.user.id, email, password };
}

export async function deleteEphemeralUser(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.auth.admin.deleteUser(userId);
}

export async function loginPatient(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in with email \+ password/i }).click();
  await page.waitForURL(/\/(dashboard|cases)\//, { timeout: 45_000 });
}

export async function logoutPatient(page: Page): Promise<void> {
  await page.context().clearCookies();
}

export async function startPatientAudit(
  page: Page,
  pathway: "pre_surgery" | "post_surgery"
): Promise<{ caseId: string; next: string } | null> {
  const response = await page.request.post("/api/audit/start", {
    data: { pathway },
  });
  if (!response.ok()) return null;
  const json = (await response.json()) as { ok?: boolean; caseId?: string; next?: string };
  if (!json.ok || !json.caseId) return null;
  return { caseId: json.caseId, next: json.next ?? `/cases/${json.caseId}/patient/photos` };
}
