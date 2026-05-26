import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

export type BulkDoctorDuplicateMatch = {
  userId: string;
  displayLabel: string;
  doctor_profile_id: string;
};

export type BulkClinicDuplicateMatch = {
  userId: string;
  displayLabel: string;
  clinic_profile_id: string;
  country?: string | null;
  city?: string | null;
};

function asTrimmed(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function sanitizeIlikePctUnderscore(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Case-insensitive exact match for Postgres ILIKE (no wildcards in user string). */
function sanitizedExactIlike(s: string): string {
  return sanitizeIlikePctUnderscore(s);
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e?.includes("@") ? e : null;
}

export function normalizeFullName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function normalizeWebsite(raw: string | null | undefined): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    const host = u.hostname.toLowerCase();
    let path = u.pathname;
    if (path === "/" || path === "") path = "";
    else path = path.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    const lower = s.toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return lower || null;
  }
}

export function synthPlaceholderEmail(kind: "doctor" | "clinic"): string {
  const token = randomBytes(10).toString("hex");
  return kind === "doctor" ? `bulk+doctor.${token}@hairaudit.dev` : `bulk+clinic.${token}@hairaudit.dev`;
}

export function generateBulkUserPassword(): string {
  return `Hb${randomBytes(18).toString("base64url")}!Aa9`;
}

export async function findDoctorMatchesByEmail(
  admin: SupabaseClient,
  email: string
): Promise<BulkDoctorDuplicateMatch | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const { data: dpRows } = await admin
    .from("doctor_profiles")
    .select("id, doctor_name, linked_user_id")
    .ilike("doctor_email", sanitizedExactIlike(normalized))
    .limit(1);
  const dp = dpRows?.[0];

  const byProfile =
    dp?.linked_user_id && dp.doctor_name
      ? ({
          userId: dp.linked_user_id,
          displayLabel: dp.doctor_name,
          doctor_profile_id: dp.id,
        } satisfies BulkDoctorDuplicateMatch)
      : null;
  if (byProfile) return byProfile;

  const { data: prof } = await admin.from("profiles").select("id, name, role, email").eq("email", normalized).maybeSingle();
  if (prof?.role === "doctor") {
    const { data: d2 } = await admin
      .from("doctor_profiles")
      .select("id, doctor_name, linked_user_id")
      .eq("linked_user_id", prof.id)
      .maybeSingle();
    if (d2?.linked_user_id && d2.doctor_name) {
      return {
        userId: d2.linked_user_id,
        displayLabel: d2.doctor_name,
        doctor_profile_id: d2.id,
      };
    }
  }
  return null;
}

export async function suggestSimilarDoctorsByName(admin: SupabaseClient, rawName: string, limit = 8) {
  const name = normalizeFullName(rawName);
  if (!name || name.length < 2) return [];
  const pattern = sanitizeIlikePctUnderscore(name);
  const { data } = await admin
    .from("doctor_profiles")
    .select("id, doctor_name, linked_user_id")
    .ilike("doctor_name", `%${pattern}%`)
    .not("linked_user_id", "is", null)
    .order("doctor_name", { ascending: true })
    .limit(limit);

  return (data ?? [])
    .filter((row) => row.linked_user_id && row.doctor_name && row.id)
    .map(
      (row) =>
        ({
          userId: row.linked_user_id as string,
          displayLabel: row.doctor_name as string,
          doctor_profile_id: row.id as string,
        }) satisfies BulkDoctorDuplicateMatch
    );
}

export async function findExactDoctorNameMatches(admin: SupabaseClient, rawName: string): Promise<BulkDoctorDuplicateMatch[]> {
  const name = normalizeFullName(rawName);
  if (!name) return [];
  const { data } = await admin
    .from("doctor_profiles")
    .select("id, doctor_name, linked_user_id")
    .ilike("doctor_name", sanitizedExactIlike(name))
    .not("linked_user_id", "is", null);
  return (data ?? [])
    .filter((row) => row.linked_user_id && row.doctor_name && row.id)
    .filter((row) => normalizeFullName(String(row.doctor_name)).toLowerCase() === name.toLowerCase())
    .map(
      (row) =>
        ({
          userId: row.linked_user_id as string,
          displayLabel: row.doctor_name as string,
          doctor_profile_id: row.id as string,
        }) satisfies BulkDoctorDuplicateMatch
    );
}

export async function findClinicMatches(admin: SupabaseClient, input: { name: string; country?: string | null; city?: string | null; website?: string | null }): Promise<{
  byWebsite: BulkClinicDuplicateMatch | null;
  byNameStrict: BulkClinicDuplicateMatch | null;
  suggestions: BulkClinicDuplicateMatch[];
}> {
  const name = normalizeFullName(input.name);
  const normalizedSite = normalizeWebsite(input.website);
  let byWebsite: BulkClinicDuplicateMatch | null = null;
  if (normalizedSite) {
    const { data: cols } = await admin
      .from("clinic_profiles")
      .select("linked_user_id, clinic_name, id, country, city, clinic_website")
      .not("clinic_website", "is", null)
      .not("linked_user_id", "is", null);

    const row = (cols ?? []).find((r) => normalizeWebsite(r.clinic_website) === normalizedSite);
    if (row?.linked_user_id && row.clinic_name && row.id) {
      byWebsite = {
        userId: row.linked_user_id,
        displayLabel: row.clinic_name,
        clinic_profile_id: row.id,
        country: row.country,
        city: row.city,
      };
    }
  }

  let byNameStrict: BulkClinicDuplicateMatch | null = null;
  const countryTrim = input.country?.trim();
  const cityTrim = input.city?.trim();
  {
    let q = admin
      .from("clinic_profiles")
      .select("linked_user_id, clinic_name, id, country, city")
      .ilike("clinic_name", sanitizedExactIlike(name))
      .not("linked_user_id", "is", null);
    if (countryTrim) q = q.ilike("country", sanitizedExactIlike(countryTrim));
    if (cityTrim) q = q.ilike("city", sanitizedExactIlike(cityTrim));

    const { data: nmRows } = await q.limit(5);
    const exactHit = (nmRows ?? []).find(
      (r) => normalizeFullName(String(r.clinic_name ?? "")).toLowerCase() === name.toLowerCase()
    );
    if (exactHit?.linked_user_id && exactHit.clinic_name && exactHit.id) {
      byNameStrict = {
        userId: exactHit.linked_user_id,
        displayLabel: exactHit.clinic_name,
        clinic_profile_id: exactHit.id,
        country: exactHit.country,
        city: exactHit.city,
      };
    }
  }

  const patternWide = sanitizeIlikePctUnderscore(name);
  const { data: sug } = await admin
    .from("clinic_profiles")
    .select("linked_user_id, clinic_name, id, country, city")
    .ilike("clinic_name", `%${patternWide}%`)
    .not("linked_user_id", "is", null)
    .order("clinic_name", { ascending: true })
    .limit(10);

  const suggestions: BulkClinicDuplicateMatch[] = [];
  const seen = new Set<string>();
  for (const r of sug ?? []) {
    if (!r.linked_user_id || !r.clinic_name || !r.id || seen.has(r.linked_user_id)) continue;
    seen.add(r.linked_user_id);
    suggestions.push({
      userId: r.linked_user_id,
      displayLabel: r.clinic_name,
      clinic_profile_id: r.id,
      country: r.country,
      city: r.city,
    });
  }

  return { byWebsite, byNameStrict, suggestions };
}

export async function resolveClinicProfileIdForUser(admin: SupabaseClient, clinicUserId: string | null | undefined) {
  if (!clinicUserId) return null;
  const { data } = await admin.from("clinic_profiles").select("id").eq("linked_user_id", clinicUserId).maybeSingle();
  return data?.id ?? null;
}

export type CreateBulkDoctorPayload = {
  doctor_name: string;
  doctor_email?: string | null;
  intake_phone?: string | null;
  country?: string | null;
  city?: string | null;
  bulk_intake_notes?: string | null;
  clinicUserId?: string | null;
};

export type CreateBulkClinicPayload = {
  clinic_name: string;
  clinic_email?: string | null;
  clinic_phone?: string | null;
  clinic_website?: string | null;
  country?: string | null;
  city?: string | null;
  bulk_intake_notes?: string | null;
};

async function upsertDoctorProfile(admin: SupabaseClient, payload: CreateBulkDoctorPayload & { linked_user_id: string }) {
  const doctorEmail = normalizeEmail(payload.doctor_email);
  const name = normalizeFullName(payload.doctor_name);
  const row = {
    linked_user_id: payload.linked_user_id,
    doctor_name: name,
    doctor_email: doctorEmail ?? null,
    intake_phone: asTrimmed(payload.intake_phone) || null,
    country: asTrimmed(payload.country) || null,
    city: asTrimmed(payload.city) || null,
    bulk_intake_notes: asTrimmed(payload.bulk_intake_notes) || null,
    clinic_profile_id: await resolveClinicProfileIdForUser(admin, payload.clinicUserId),
    updated_at: new Date().toISOString(),
  };

  const { data: exists } = await admin.from("doctor_profiles").select("id").eq("linked_user_id", payload.linked_user_id).maybeSingle();
  if (exists?.id) {
    const { data, error } = await admin.from("doctor_profiles").update(row).eq("id", exists.id).select("id").single();
    if (error) throw new Error(error.message);
    return data?.id ?? exists.id;
  }
  const { data, error } = await admin.from("doctor_profiles").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return data?.id ?? "";
}

export async function createBulkDoctor(admin: SupabaseClient, payload: CreateBulkDoctorPayload) {
  const name = normalizeFullName(payload.doctor_name);
  if (!name) throw new Error("Doctor name is required");

  let emailResolved = normalizeEmail(payload.doctor_email);
  if (!emailResolved) {
    emailResolved = synthPlaceholderEmail("doctor");
  }

  const password = generateBulkUserPassword();
  const created = await admin.auth.admin.createUser({
    email: emailResolved,
    password,
    email_confirm: true,
    user_metadata: { role: "doctor", full_name: name },
  });

  if (created.error || !created.data.user?.id) {
    throw new Error(created.error?.message ?? "Could not create auth user for doctor");
  }

  const userId = created.data.user.id;
  await admin.from("profiles").upsert(
    {
      id: userId,
      role: "doctor",
      email: emailResolved,
      name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  const profileId = await upsertDoctorProfile(admin, {
    ...payload,
    linked_user_id: userId,
  });

  return { userId, doctorProfileId: profileId, displayLabel: name, emailUsed: emailResolved };
}

export async function upsertClinicProfileRow(
  admin: SupabaseClient,
  payload: CreateBulkClinicPayload & { linked_user_id: string }
) {
  const clinicEmail = normalizeEmail(payload.clinic_email);
  const site = normalizeWebsite(payload.clinic_website);
  const row = {
    linked_user_id: payload.linked_user_id,
    clinic_name: normalizeFullName(payload.clinic_name),
    clinic_email: clinicEmail ?? null,
    clinic_phone: asTrimmed(payload.clinic_phone) || null,
    clinic_website: site,
    country: asTrimmed(payload.country) || null,
    city: asTrimmed(payload.city) || null,
    bulk_intake_notes: asTrimmed(payload.bulk_intake_notes) || null,
    updated_at: new Date().toISOString(),
  };

  const { data: exists } = await admin.from("clinic_profiles").select("id").eq("linked_user_id", payload.linked_user_id).maybeSingle();
  if (exists?.id) {
    const { data, error } = await admin.from("clinic_profiles").update(row).eq("id", exists.id).select("id").single();
    if (error) throw new Error(error.message);
    return data?.id ?? exists.id;
  }

  const { data, error } = await admin.from("clinic_profiles").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return data?.id ?? "";
}

export async function createBulkClinic(admin: SupabaseClient, payload: CreateBulkClinicPayload) {
  const clinic_name = normalizeFullName(payload.clinic_name);
  if (!clinic_name) throw new Error("Clinic name is required");

  let emailResolved = normalizeEmail(payload.clinic_email);
  if (!emailResolved) {
    emailResolved = synthPlaceholderEmail("clinic");
  }

  const password = generateBulkUserPassword();
  const created = await admin.auth.admin.createUser({
    email: emailResolved,
    password,
    email_confirm: true,
    user_metadata: { role: "clinic", full_name: clinic_name },
  });

  if (created.error || !created.data.user?.id) {
    throw new Error(created.error?.message ?? "Could not create auth user for clinic");
  }

  const userId = created.data.user.id;
  await admin.from("profiles").upsert(
    {
      id: userId,
      role: "clinic",
      email: emailResolved,
      name: clinic_name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  const clinicProfileId = await upsertClinicProfileRow(admin, {
    ...payload,
    clinic_name,
    clinic_email: normalizeEmail(payload.clinic_email),
    linked_user_id: userId,
  });

  return { userId, clinicProfileId, displayLabel: clinic_name, emailUsed: emailResolved };
}
