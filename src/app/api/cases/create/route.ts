import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseCookieHeader(cookieHeader: string | null) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;

  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = v;
  }
  return out;
}

function base64UrlToString(input: string) {
  // base64url -> base64
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  // pad
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64").toString("utf8");
}

function decodeAuthCookieValue(raw: string) {
  // Try raw JSON first
  try {
    return JSON.parse(raw);
  } catch {}

  // Try URL-decoded JSON
  try {
    const u = decodeURIComponent(raw);
    return JSON.parse(u);
  } catch {}

  // Supabase sometimes prefixes base64 values
  const noPrefix = raw.startsWith("base64-") ? raw.slice("base64-".length) : raw;

  // Try base64url JSON
  try {
    const decoded = base64UrlToString(noPrefix);
    return JSON.parse(decoded);
  } catch {}

  // Try base64 (non-url) JSON
  try {
    const decoded = Buffer.from(noPrefix, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {}

  return null;
}

function findSupabaseAuthPayload(cookiesObj: Record<string, string>) {
  // We’re looking for sb-<ref>-auth-token OR chunked sb-<ref>-auth-token.0/.1/.2...
  // Find all cookie names containing "-auth-token"
  const names = Object.keys(cookiesObj).filter((n) => n.includes("-auth-token"));

  if (names.length === 0) return null;

  // Prefer chunked forms if present
  // Group by base name (strip .<number> suffix)
  const groups: Record<string, { name: string; idx: number; val: string }[]> = {};
  for (const name of names) {
    const m = name.match(/^(.*-auth-token)(?:\.(\d+))?$/);
    if (!m) continue;
    const base = m[1];
    const idx = m[2] ? Number(m[2]) : -1;
    groups[base] = groups[base] || [];
    groups[base].push({ name, idx, val: cookiesObj[name] });
  }

  // Choose the group that looks like Supabase (sb-...-auth-token)
  const bases = Object.keys(groups).sort((a, b) => {
    const aScore = a.startsWith("sb-") ? 1 : 0;
    const bScore = b.startsWith("sb-") ? 1 : 0;
    return bScore - aScore;
  });

  for (const base of bases) {
    const parts = groups[base].slice().sort((a, b) => a.idx - b.idx);
    // If idx == -1, it’s a single cookie; keep as-is
    const combined =
      parts.length === 1 && parts[0].idx === -1
        ? parts[0].val
        : parts.map((p) => p.val).join("");

    const payload = decodeAuthCookieValue(combined);
    if (payload?.access_token) {
      return { baseName: base, payload };
    }
  }

  return null;
}

export async function POST(req: Request) {
  // 1) Read cookies from request header (works reliably in Next 16 route handlers)
  const cookieHeader = req.headers.get("cookie");
  const cookieMap = parseCookieHeader(cookieHeader);

  const found = findSupabaseAuthPayload(cookieMap);

  if (!found) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated (no usable Supabase auth cookie found)" },
      { status: 401 }
    );
  }

  const accessToken = found.payload.access_token as string;

  // 2) Admin client
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 3) Validate user from token
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);

  if (userErr || !userData.user) {
    return NextResponse.json(
      { ok: false, error: "Invalid session (token rejected by Supabase)" },
      { status: 401 }
    );
  }

  // 4) Get user role for case linking
  let role = (userData.user.user_metadata as Record<string, unknown>)?.role as string | undefined;
  try {
    const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (profile?.role) role = profile.role as string;
  } catch { /* profiles may not exist */ }

  // In development, allow dev_role cookie to override
  if (process.env.NODE_ENV === "development") {
    const devRole = cookieMap.dev_role;
    if (devRole && ["patient", "doctor", "clinic", "auditor"].includes(devRole)) {
      role = devRole;
    }
  }

  const insertData: Record<string, unknown> = {
    user_id: userData.user.id,
    title: role === "doctor" ? "Doctor audit" : role === "clinic" ? "Clinic audit" : "Patient Audit",
    status: "draft",
  };
  if (role === "patient") insertData.patient_id = userData.user.id;
  if (role === "doctor") insertData.doctor_id = userData.user.id;
  if (role === "clinic") insertData.clinic_id = userData.user.id;

  // 5) Insert case row
  const { data, error } = await supabaseAdmin
    .from("cases")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, caseId: data.id });
}

