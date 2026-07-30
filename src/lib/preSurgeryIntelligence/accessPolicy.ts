/**
 * HA-PRE-SURGERY-INTELLIGENCE-2B — Pure access matrix (unit-testable, no I/O).
 */

export type PreSurgeryAccessSubject = {
  userId: string;
  isAuditor: boolean;
  caseUserId: string | null;
  casePatientId: string | null;
  caseDoctorId: string | null;
  caseClinicId: string | null;
};

export type PreSurgeryAccessDecision =
  | { allowed: true; role: "auditor" | "assigned_doctor" | "assigned_clinic" }
  | { allowed: false; reason: "patient_owner" | "unrelated_professional" | "unauthenticated" };

/**
 * Professional planning records: auditors + assigned doctor/clinic only.
 * Patients and unrelated professionals are denied even if they can open the case report.
 */
export function decidePreSurgeryClinicianAccess(subject: PreSurgeryAccessSubject): PreSurgeryAccessDecision {
  if (!subject.userId) return { allowed: false, reason: "unauthenticated" };
  if (subject.isAuditor) return { allowed: true, role: "auditor" };
  if (subject.caseDoctorId && subject.caseDoctorId === subject.userId) {
    return { allowed: true, role: "assigned_doctor" };
  }
  if (subject.caseClinicId && subject.caseClinicId === subject.userId) {
    return { allowed: true, role: "assigned_clinic" };
  }
  const isPatient =
    subject.caseUserId === subject.userId || subject.casePatientId === subject.userId;
  if (isPatient) return { allowed: false, reason: "patient_owner" };
  return { allowed: false, reason: "unrelated_professional" };
}
