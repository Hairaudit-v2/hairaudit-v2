import { NextResponse } from "next/server";
import { CAPABILITY_TYPES, resolveClinicProfileForUser } from "@/lib/clinicPortal";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

export const runtime = "nodejs";

function isCapabilityType(value: string): value is (typeof CAPABILITY_TYPES)[number] {
  return CAPABILITY_TYPES.includes(value as (typeof CAPABILITY_TYPES)[number]);
}

export async function GET() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userEmail = String(user.email ?? "").toLowerCase();
  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail,
  });
  if (!clinicProfile) return NextResponse.json({ error: "Clinic profile missing" }, { status: 500 });

  const { data, error } = await admin
    .from("clinic_capability_catalog")
    .select("id, capability_type, capability_name, capability_details, is_active, sort_order, created_at")
    .eq("clinic_profile_id", clinicProfile.id)
    .order("capability_type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type = String(body?.capabilityType ?? "").trim();
  const name = String(body?.capabilityName ?? "").trim();
  if (!type || !name || !isCapabilityType(type)) {
    return NextResponse.json({ error: "Invalid capability payload" }, { status: 400 });
  }

  const userEmail = String(user.email ?? "").toLowerCase();
  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail,
  });
  if (!clinicProfile) return NextResponse.json({ error: "Clinic profile missing" }, { status: 500 });

  const payload = {
    clinic_profile_id: clinicProfile.id,
    capability_type: type,
    capability_name: name,
    capability_details:
      body?.capabilityDetails && typeof body.capabilityDetails === "object" ? body.capabilityDetails : {},
    is_active: body?.isActive !== false,
    sort_order: Number(body?.sortOrder ?? 0),
  };

  const { data, error } = await admin
    .from("clinic_capability_catalog")
    .insert(payload)
    .select("id, capability_type, capability_name, capability_details, is_active, sort_order, created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const itemId = String(searchParams.get("id") ?? "").trim();
  if (!itemId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const userEmail = String(user.email ?? "").toLowerCase();
  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail,
  });
  if (!clinicProfile) return NextResponse.json({ error: "Clinic profile missing" }, { status: 500 });

  const { error } = await admin
    .from("clinic_capability_catalog")
    .delete()
    .eq("id", itemId)
    .eq("clinic_profile_id", clinicProfile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
