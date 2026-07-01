# HairAudit Nexus Receiver (HA-NEXUS-1)

HairAudit acts as a **network clinical audit node** in the FI Network. Trusted upstream systems (FI OS, IIOHR) provision certified professionals into HairAudit using HMAC-signed HTTP webhooks. Provisioning is **disabled by default** and **fails closed** when required secrets are missing.

## Architecture

```
FI OS / IIOHR ──HMAC POST──► HairAudit /api/nexus/*
                                  │
                                  ├─ hairaudit_nexus_external_professionals
                                  ├─ hairaudit_nexus_memberships
                                  ├─ hairaudit_nexus_entitlements
                                  ├─ hairaudit_nexus_provisioning_audit
                                  └─ doctor_profiles.external_provider_id (network anchor)
```

Doctor identity is anchored on `global_professional_id` stored as `doctor_profiles.external_provider_id`. Email is informational only and must **not** be used alone to grant access.

## Routes

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/nexus/provision` | Idempotent upsert of professional + membership + entitlements |
| `GET` | `/api/nexus/state?globalProfessionalId=` | Reconciliation read |
| `POST` | `/api/nexus/rollback` | Revoke/suspend network access |

All routes require `HA_NEXUS_ENABLED=true` and a configured `HA_NEXUS_SECRET` (minimum 16 characters).

## HMAC authentication

| Detail | Value |
|--------|-------|
| Algorithm | HMAC-SHA256 (hex digest) |
| Material | `{timestamp}.{rawBody}` |
| Timestamp header | `x-ha-nexus-webhook-timestamp` |
| Signature header | `x-ha-nexus-webhook-signature` |
| Skew | 5 minutes |
| `POST` body | Exact UTF-8 JSON bytes |
| `GET` state | Sign raw `globalProfessionalId` query value (not JSON) |

HTTP statuses:

- `403` — Nexus disabled (`HA_NEXUS_ENABLED` not truthy)
- `503` — Secret missing or too short
- `401` — Invalid/missing signature or timestamp

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HA_NEXUS_ENABLED` | `false` | Master feature gate |
| `HA_NEXUS_SECRET` | unset | Shared HMAC secret (≥16 chars) |
| `HA_NEXUS_ALLOWED_SOURCES` | `fi_os,iiohr` | Comma-separated allowed `sourceSystem` values |

### Commercial access policy (HairAudit stays open by default)

| Variable | Default | Description |
|----------|---------|-------------|
| `HA_ALLOW_PUBLIC_PATIENT_AUDITS` | `true` | Patient self-audit pathway |
| `HA_ALLOW_STANDALONE_DOCTOR_SIGNUP` | `true` | Independent doctor signup |
| `HA_ALLOW_STANDALONE_CLINIC_SIGNUP` | `true` | Independent clinic signup |
| `HA_REQUIRE_NEXUS_FOR_PROFESSIONAL_UPLOAD` | `false` | When `true`, only Nexus-approved professionals may upload/create/submit |
| `HA_REQUIRE_LOCAL_APPROVAL_FOR_STANDALONE_PROFESSIONALS` | `true` | Standalone doctors/clinics need `participation_approval_status=approved` |

Nexus is an **acceleration/verification layer** for IIOHR/FI OS network doctors — not the only commercial route unless `HA_REQUIRE_NEXUS_FOR_PROFESSIONAL_UPLOAD=true`.

## Provision payload

```json
{
  "globalProfessionalId": "iiohr:prof:001",
  "email": "surgeon@clinic.example",
  "fullName": "Dr Example",
  "professionalRole": "hair_surgeon",
  "trainingStatus": "certified",
  "certificationLevel": "board_certified",
  "sourceSystem": "iiohr",
  "sourceExternalId": "iiohr-staff-123",
  "entitlementKeys": ["clinical_audit_upload", "case_creation", "report_access"],
  "approvalStatus": "pending",
  "provisionStatus": "provisioned",
  "metadata": {}
}
```

Canonical entitlement keys:

- `clinical_audit_upload`
- `case_creation`
- `report_access`
- `surgery_upload`

## Rollback payload

```json
{
  "globalProfessionalId": "iiohr:prof:001",
  "reason": "certification revoked in IIOHR",
  "action": "revoke"
}
```

`action` may be `revoke` (default) or `suspend`.

## Approval enforcement

Two parallel professional paths:

1. **Standalone doctors/clinics** — signup remains available; professional upload/create/submit requires local `participation_approval_status=approved` when `HA_REQUIRE_LOCAL_APPROVAL_FOR_STANDALONE_PROFESSIONALS=true` (default).
2. **Network-provisioned doctors** — identified by `external_provider_id` + Nexus membership; require Nexus `approval_status=approved` and active entitlements. Suspended/revoked network status always blocks.

Strict network-only mode: set `HA_REQUIRE_NEXUS_FOR_PROFESSIONAL_UPLOAD=true` (blocks all non-network professionals).

Enforced at:

- Case creation (`createAuditCase`)
- Submit API
- Surgery upload actor resolution
- Report PDF access (doctor/clinic participants)
- Doctor dashboard case list (pending doctors see no cases)

Patient flows are unchanged.

## Database tables

See migration `supabase/migrations/20260702120000_hairaudit_nexus_network_identity.sql`.

Audit rows are written to `hairaudit_nexus_provisioning_audit` on every provision/rollback outcome with `before_state` / `after_state` snapshots.

## Expected upstream integration

FI OS / IIOHR should treat HairAudit as a downstream clinical audit node:

1. Provision professional with `globalProfessionalId` stable across the network
2. Set `approvalStatus` to `pending` until network approval completes
3. Re-provision with `approved` + entitlements to activate upload/access
4. Rollback on certification revocation

No SSO/OIDC is required for Phase HA-NEXUS-1.

## Tests

```bash
pnpm test:nexus
pnpm test:report-access
pnpm test:create-case
```
