export type HaNexusExternalProfessionalRow = {
  id: string;
  global_professional_id: string;
  source_system: string;
  source_external_id: string | null;
  email: string;
  full_name: string | null;
  professional_role: string;
  training_status: string | null;
  certification_level: string | null;
  doctor_profile_id: string | null;
  nexus_created: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type HaNexusMembershipRow = {
  id: string;
  global_professional_id: string;
  doctor_profile_id: string | null;
  approval_status: string;
  provision_status: string;
  revoked_at: string | null;
  suspended_at: string | null;
  nexus_created: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type HaNexusEntitlementRow = {
  id: string;
  global_professional_id: string;
  entitlement_key: string;
  active: boolean;
  nexus_created: boolean;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HaNexusProvisionPayload = {
  globalProfessionalId: string;
  email: string;
  fullName?: string | null;
  professionalRole: string;
  trainingStatus?: string | null;
  certificationLevel?: string | null;
  sourceSystem?: string;
  sourceExternalId?: string | null;
  entitlementKeys: string[];
  approvalStatus?: string;
  provisionStatus?: string;
  metadata?: Record<string, unknown> | null;
};

export type HaNexusRollbackPayload = {
  globalProfessionalId: string;
  reason: string;
  action?: "revoke" | "suspend";
};

export type ExternalProfessionalState = {
  professional: HaNexusExternalProfessionalRow | null;
  membership: HaNexusMembershipRow | null;
  activeEntitlements: HaNexusEntitlementRow[];
  doctorProfileId: string | null;
  auditCount: number;
  reconciliationWarnings: string[];
};

export type ProvisionResult =
  | { ok: true; state: ExternalProfessionalState }
  | { ok: false; error: string; httpStatus: number };

export type RollbackResult =
  | { ok: true; state: ExternalProfessionalState }
  | { ok: false; error: string; httpStatus: number };

export type ReadStateResult =
  | { ok: true; state: ExternalProfessionalState }
  | { ok: false; error: string; httpStatus: number };

export const GLOBAL_PROFESSIONAL_ID_RE = /^[a-zA-Z0-9._:-]{3,128}$/;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
