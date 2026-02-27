import type { AuditMode } from "@/lib/pdf/reportBuilder";

export function resolveAuditModeFromCaseAccess(args: {
  role?: string | null;
  userId?: string | null;
  caseRow?: {
    user_id?: string | null;
    patient_id?: string | null;
    doctor_id?: string | null;
    clinic_id?: string | null;
  } | null;
}): AuditMode {
  const role = args.role ?? null;
  const userId = args.userId ?? null;
  const c = args.caseRow ?? null;

  const isAuditor = role === "auditor";
  const isPatientForCase = !!userId && !!c && (userId === c.user_id || userId === c.patient_id);
  const isDoctorForCase = !!userId && !!c && userId === c.doctor_id;
  const isClinicForCase = !!userId && !!c && userId === c.clinic_id;

  if (isAuditor) return "auditor";
  if (isDoctorForCase) return "doctor";
  if (isClinicForCase) return "clinic";
  if (isPatientForCase) return "patient";
  return "patient";
}

