/**
 * HairAudit commercial access policy (HA-NEXUS-1).
 * Nexus is an acceleration layer — standalone patient/doctor/clinic pathways stay open by default.
 */

function truthyEnv(v: string | undefined, defaultWhenUnset = true): boolean {
  if (v === undefined || v.trim() === "") return defaultWhenUnset;
  const s = v.trim().toLowerCase();
  if (s === "0" || s === "false" || s === "no") return false;
  if (s === "1" || s === "true" || s === "yes") return true;
  return defaultWhenUnset;
}

export function readHaAllowPublicPatientAudits(): boolean {
  return truthyEnv(process.env.HA_ALLOW_PUBLIC_PATIENT_AUDITS, true);
}

export function readHaAllowStandaloneDoctorSignup(): boolean {
  return truthyEnv(process.env.HA_ALLOW_STANDALONE_DOCTOR_SIGNUP, true);
}

export function readHaAllowStandaloneClinicSignup(): boolean {
  return truthyEnv(process.env.HA_ALLOW_STANDALONE_CLINIC_SIGNUP, true);
}

/** When true, only network-verified (Nexus-approved) professionals may upload/create/submit. */
export function readHaRequireNexusForProfessionalUpload(): boolean {
  return truthyEnv(process.env.HA_REQUIRE_NEXUS_FOR_PROFESSIONAL_UPLOAD, false);
}

export function readHaRequireLocalApprovalForStandaloneProfessionals(): boolean {
  return truthyEnv(process.env.HA_REQUIRE_LOCAL_APPROVAL_FOR_STANDALONE_PROFESSIONALS, true);
}

export type HaAccessPolicySnapshot = {
  allowPublicPatientAudits: boolean;
  allowStandaloneDoctorSignup: boolean;
  allowStandaloneClinicSignup: boolean;
  requireNexusForProfessionalUpload: boolean;
  requireLocalApprovalForStandaloneProfessionals: boolean;
};

export function readHaAccessPolicySnapshot(
  env: NodeJS.ProcessEnv = process.env
): HaAccessPolicySnapshot {
  return {
    allowPublicPatientAudits: truthyEnv(env.HA_ALLOW_PUBLIC_PATIENT_AUDITS, true),
    allowStandaloneDoctorSignup: truthyEnv(env.HA_ALLOW_STANDALONE_DOCTOR_SIGNUP, true),
    allowStandaloneClinicSignup: truthyEnv(env.HA_ALLOW_STANDALONE_CLINIC_SIGNUP, true),
    requireNexusForProfessionalUpload: truthyEnv(env.HA_REQUIRE_NEXUS_FOR_PROFESSIONAL_UPLOAD, false),
    requireLocalApprovalForStandaloneProfessionals: truthyEnv(
      env.HA_REQUIRE_LOCAL_APPROVAL_FOR_STANDALONE_PROFESSIONALS,
      true
    ),
  };
}
