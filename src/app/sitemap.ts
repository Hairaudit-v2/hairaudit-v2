import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PUBLIC_ROUTES = [
  "/",
  "/how-it-works",
  "/request-review",
  "/sample-report",
  "/audit-examples",
  "/hair-transplant-problems",
  "/hair-transplant-too-thin",
  "/hair-transplant-not-growing",
  "/hair-transplant-donor-overharvested",
  "/hair-transplant-graft-failure",
  "/bad-hair-transplant-hairline",
  "/rate-my-hair-transplant",
  "/is-my-hair-transplant-normal",
  "/great-hair-transplants",
  "/best-hair-transplant-results",
  "/community-results",
  "/clinics",
  "/professionals",
  "/professionals/apply",
  "/verified-surgeon-program",
  "/methodology",
  "/services",
  "/benchmark-vision",
  "/follicle-intelligence",
  "/about",
  "/faq",
  "/privacy",
  "/terms",
  "/disclaimer",
];

function toLastModified(value: string | null | undefined): Date {
  if (value == null) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? SITE_URL).replace(
      /\/+$/,
      ""
    );
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : route === "/request-review" ? 0.9 : 0.7,
  }));

  const admin = createSupabaseAdminClient();
  const { data: clinicRows } = await admin
    .from("clinic_profiles")
    .select("clinic_slug, updated_at")
    .eq("profile_visible", true)
    .not("clinic_slug", "is", null);

  const clinicEntries: MetadataRoute.Sitemap = (clinicRows ?? []).map(
    (row: { clinic_slug: string | null; updated_at?: string | null }) => {
      const slug = row.clinic_slug ?? "";
      return {
        url: `${baseUrl}/clinics/${encodeURIComponent(slug)}`,
        lastModified: toLastModified(row.updated_at),
        changeFrequency: "weekly",
        priority: 0.6,
      };
    }
  );

  return [...staticEntries, ...clinicEntries];
}
