export type AccountClaimLinkAction =
  | "token_created"
  | "token_resent"
  | "token_claimed"
  | "token_expired"
  | "token_revoked"
  | "claim_failed";

export type AccountClaimActorType = "system" | "admin" | "doctor" | "nexus";

export type AccountClaimTokenRow = {
  id: string;
  token_hash: string;
  global_professional_id: string;
  doctor_profile_id: string;
  external_professional_id: string | null;
  intended_email_snapshot: string;
  role_snapshot: string;
  expires_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
  created_by_system: string;
  created_by_user_id: string | null;
  consumed_by_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AccountClaimLinkAuditRow = {
  id: string;
  doctor_profile_id: string | null;
  global_professional_id: string | null;
  linked_user_id: string | null;
  action: AccountClaimLinkAction;
  actor_type: AccountClaimActorType;
  actor_user_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AccountClaimInvalidReason =
  | "not_found"
  | "expired"
  | "revoked"
  | "already_claimed"
  | "malformed";

export type AccountClaimValidationResult =
  | {
      valid: true;
      role: string;
      maskedEmail: string;
      expiresAt: string;
    }
  | {
      valid: false;
      reason: AccountClaimInvalidReason;
    };

export type AccountClaimStatus = {
  doctorProfileId: string;
  globalProfessionalId: string;
  hasActiveToken: boolean;
  activeTokenExpiresAt: string | null;
  claimedAt: string | null;
  revokedAt: string | null;
  linkedUserId: string | null;
};

export type CreateClaimTokenResult = {
  tokenId: string;
  expiresAt: string;
  /** Plaintext token for server-side email/dev handoff only — never log or expose to clients by default. */
  plaintextToken: string;
  created: boolean;
};

export const DEFAULT_CLAIM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
