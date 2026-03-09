import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import BadgeWidget from "@/components/clinic-profile/BadgeWidget";
import { BADGE_PUBLIC_SELECT, type PublicBadgePayload } from "@/lib/clinics/badgeData";
import { headers } from "next/headers";

type SearchParams = { variant?: string; style?: string };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const { variant } = await searchParams;
  return {
    title: `HairAudit verification badge${variant ? ` (${variant})` : ""} | HairAudit`,
    robots: "noindex, nofollow",
  };
}

export default async function ClinicBadgePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const variant = (sp.variant === "full" ? "full" : "compact") as "compact" | "full";
  const style = (sp.style === "light" ? "light" : "dark") as "dark" | "light";

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("clinic_profiles")
    .select(BADGE_PUBLIC_SELECT)
    .eq("clinic_slug", slug)
    .eq("profile_visible", true)
    .maybeSingle();

  if (error || !data) notFound();

  const row = data as PublicBadgePayload;
  if (!row.clinic_slug || !row.profile_visible) notFound();

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

  const bgClass = style === "light" ? "bg-slate-100" : "bg-[#0a0a0f]";
  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${bgClass}`}>
      <div className="flex flex-col items-center gap-6">
        <BadgeWidget
          clinicName={row.clinic_name}
          clinicSlug={row.clinic_slug}
          currentAwardTier={row.current_award_tier}
          participationStatus={row.participation_status}
          variant={variant}
          style={style}
          linkToProfile={true}
          baseUrl={baseUrl}
        />
      </div>
    </div>
  );
}
