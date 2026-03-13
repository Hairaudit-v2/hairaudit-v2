import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { resolveClinicProfileForUser } from "@/lib/clinicPortal";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

  const [{ data: ownedCases }, { data: requestedCases }, { data: workspaces }] = await Promise.all([
    admin
      .from("cases")
      .select("id, title, status, created_at, submitted_at, submission_channel, visibility_scope")
      .eq("clinic_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("case_contribution_requests")
      .select("case_id, status")
      .eq("clinic_profile_id", clinicProfile.id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("clinic_case_workspaces")
      .select(
        "case_id, submission_channel, visibility_scope, clinic_response_status, clinic_response_summary, clinic_response_payload, responded_at, training_flag, benchmark_include, white_label_scope, updated_at"
      )
      .eq("clinic_profile_id", clinicProfile.id),
  ]);

  const ownedIds = new Set((ownedCases ?? []).map((r) => String(r.id)));
  const contributedIds = [...new Set((requestedCases ?? []).map((r) => String(r.case_id ?? "")).filter(Boolean))];
  const missingContributedIds = contributedIds.filter((id) => !ownedIds.has(id));

  const { data: contributedCaseRows } =
    missingContributedIds.length > 0
      ? await admin
          .from("cases")
          .select("id, title, status, created_at, submitted_at, submission_channel, visibility_scope")
          .in("id", missingContributedIds)
      : { data: [] as Array<Record<string, unknown>> };

  const allCases = [...(ownedCases ?? []), ...(contributedCaseRows ?? [])];
  const workspaceByCase = new Map(
    (workspaces ?? []).map((w) => [String((w as { case_id: string }).case_id), w])
  );
  const requestByCase = new Map(
    (requestedCases ?? []).map((r) => [String((r as { case_id: string }).case_id), String((r as { status: string }).status)])
  );

  const items = allCases.map((c) => {
    const caseId = String(c.id);
    const workspace = workspaceByCase.get(caseId) as Record<string, unknown> | undefined;
    const requestStatus = requestByCase.get(caseId);
    return {
      caseId,
      title: c.title ?? "Clinic audit case",
      status: c.status ?? "draft",
      createdAt: c.created_at,
      submittedAt: c.submitted_at ?? null,
      visibilityScope: workspace?.visibility_scope ?? c.visibility_scope ?? "internal",
      submissionChannel: workspace?.submission_channel ?? c.submission_channel ?? "patient_submitted",
      clinicResponseStatus:
        workspace?.clinic_response_status ??
        (requestStatus ? "pending_response" : "not_requested"),
      clinicResponseSummary: workspace?.clinic_response_summary ?? "",
      trainingFlag: Boolean(workspace?.training_flag),
      benchmarkInclude: workspace?.benchmark_include !== false,
      whiteLabelScope: String(workspace?.white_label_scope ?? "hairaudit"),
      updatedAt: workspace?.updated_at ?? c.created_at,
    };
  });

  items.sort((a, b) => {
    const bt = new Date(String(b.updatedAt ?? b.createdAt ?? 0)).getTime();
    const at = new Date(String(a.updatedAt ?? a.createdAt ?? 0)).getTime();
    return bt - at;
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const caseId = String(body?.caseId ?? "").trim();
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });

  const userEmail = String(user.email ?? "").toLowerCase();
  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail,
  });
  if (!clinicProfile) return NextResponse.json({ error: "Clinic profile missing" }, { status: 500 });

  const { data: caseRow } = await admin
    .from("cases")
    .select("id, clinic_id, visibility_scope, submission_channel")
    .eq("id", caseId)
    .maybeSingle();

  const { data: linkedRequest } = await admin
    .from("case_contribution_requests")
    .select("id")
    .eq("case_id", caseId)
    .eq("clinic_profile_id", clinicProfile.id)
    .limit(1)
    .maybeSingle();

  if (!caseRow || (String(caseRow.clinic_id ?? "") !== user.id && !linkedRequest)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const visibilityScope = String(body?.visibilityScope ?? caseRow.visibility_scope ?? "internal");
  const submissionChannel = String(body?.submissionChannel ?? caseRow.submission_channel ?? "patient_submitted");

  const payload = {
    case_id: caseId,
    clinic_profile_id: clinicProfile.id,
    visibility_scope: visibilityScope === "public" ? "public" : "internal",
    submission_channel: submissionChannel,
    clinic_response_status: String(body?.clinicResponseStatus ?? "pending_response"),
    clinic_response_summary: String(body?.clinicResponseSummary ?? "").trim(),
    clinic_response_payload: asRecord(body?.clinicResponsePayload),
    responded_at:
      String(body?.clinicResponseStatus ?? "").trim() === "responded" ? new Date().toISOString() : null,
    training_flag: Boolean(body?.trainingFlag),
    benchmark_include: body?.benchmarkInclude !== false,
    white_label_scope: String(body?.whiteLabelScope ?? "hairaudit"),
  };

  const { data, error } = await admin
    .from("clinic_case_workspaces")
    .upsert(payload, { onConflict: "case_id" })
    .select(
      "case_id, submission_channel, visibility_scope, clinic_response_status, clinic_response_summary, clinic_response_payload, responded_at, training_flag, benchmark_include, white_label_scope, updated_at"
    )
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin
    .from("cases")
    .update({
      visibility_scope: payload.visibility_scope,
      submission_channel: payload.submission_channel,
      clinic_submission_notes: payload.clinic_response_summary || null,
    })
    .eq("id", caseId);

  return NextResponse.json({ ok: true, workspace: data });
}
