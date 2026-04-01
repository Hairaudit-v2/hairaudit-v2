import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { requireAcademyStaff } from "@/lib/academy/auth";

export const runtime = "nodejs";

type CreateCaseBody = {
  training_doctor_id: string;
  surgery_date: string;
  procedure_type?: string | null;
  complexity_level?: string | null;
  patient_sex?: string | null;
  patient_age_band?: string | null;
  notes?: string | null;
  trainer_id?: string | null;
};

export async function POST(req: Request) {
  try {
    await requireAcademyStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: CreateCaseBody;
  try {
    body = (await req.json()) as CreateCaseBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const doctorId = body.training_doctor_id?.trim();
  const surgeryDate = body.surgery_date?.trim();
  if (!doctorId || !surgeryDate) {
    return NextResponse.json(
      { ok: false, error: "training_doctor_id and surgery_date are required" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const trainerId = body.trainer_id?.trim() || user.id;

  const { data, error } = await supabase
    .from("training_cases")
    .insert({
      training_doctor_id: doctorId,
      trainer_id: trainerId,
      surgery_date: surgeryDate,
      procedure_type: body.procedure_type?.trim() || null,
      complexity_level: body.complexity_level?.trim() || null,
      patient_sex: body.patient_sex?.trim() || null,
      patient_age_band: body.patient_age_band?.trim() || null,
      notes: body.notes?.trim() || null,
      created_by: user.id,
      status: "draft",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, case: data });
}
