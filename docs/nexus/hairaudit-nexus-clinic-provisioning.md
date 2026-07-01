# HairAudit Nexus Clinic Provisioning (HA-NEXUS-3)

Network-provisioned **clinic shells** for FI OS / IIOHR, using the same safe architecture as HA-NEXUS-1/2 for doctors. Standalone clinic signup remains available.

## Architecture

```
FI OS / IIOHR ──HMAC POST──► HairAudit /api/nexus/provision
                                  │
                    entityType=clinic │
                                  ├─ hairaudit_nexus_external_clinics
                                  ├─ hairaudit_nexus_clinic_memberships
                                  ├─ hairaudit_nexus_clinic_entitlements
                                  ├─ hairaudit_nexus_provisioning_audit (entity_type=clinic)
                                  ├─ clinic_profiles.external_clinic_id (network anchor)
                                  └─ hairaudit_account_claim_tokens (claim_subject_type=clinic)
```

Clinic identity is anchored on `global_clinic_id` stored as `clinic_profiles.external_clinic_id`. **Email is never used alone to link clinics.**

## Provision payload

Set `"entityType": "clinic"` on the existing provision route. Doctor payloads without `entityType` continue to work unchanged.

```json
{
  "entityType": "clinic",
  "globalClinicId": "fi_os:clinic:001",
  "clinicName": "Example Hair Clinic",
  "primaryContactEmail": "admin@clinic.example",
  "primaryContactName": "Clinic Admin",
  "country": "TR",
  "region": "Istanbul",
  "fiTenantId": "fi-tenant-abc",
  "fiClinicId": "fi-clinic-xyz",
  "sourceSystem": "fi_os",
  "sourceExternalId": "fi-clinic-row-123",
  "entitlementKeys": ["clinical_audit_upload", "case_creation", "report_access"],
  "approvalStatus": "pending",
  "provisionStatus": "active",
  "metadata": {}
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `entityType` | Yes (clinic) | Must be `"clinic"` |
| `globalClinicId` | Yes | Cross-system durable key (`3–128` chars) |
| `clinicName` | Yes | Display name |
| `primaryContactEmail` | Yes | Invite target; **not** a linking key |
| `entitlementKeys` | Yes | Same canonical keys as doctors |
| `approvalStatus` | No | `pending`, `approved`, `suspended`, `revoked` |
| `provisionStatus` | No | `active`, `pending`, `rolled_back` |
| `sourceSystem` | No | Must be in `HA_NEXUS_ALLOWED_SOURCES` (default `fi_os,iiohr`) |

## Safe linking rules

1. Lookup/create `clinic_profiles` **only** by `external_clinic_id = globalClinicId`.
2. If an existing profile matches the same anchor, update safe metadata (name, contact email snapshot, approval status).
3. If no profile exists, create an **inactive shell** (`linked_user_id = null`).
4. If a profile exists with the same email but **no** matching external anchor → **conflict** (409, audited). HairAudit does not merge by email.
5. If a profile exists with a **different** external anchor but same email → **conflict** (409, audited).

## Claim lifecycle

1. Provision creates clinic shell + hashed claim token (`claim_subject_type=clinic`).
2. Invite email points to `/signup?claimToken=...` (same route as doctors).
3. Validate returns `subjectType`, `displayName` (clinic name), masked email, expiry — no internal IDs.
4. User signs up/signs in with **clinic role forced** (no role picker in claim mode).
5. Claim links `clinic_profiles.linked_user_id` and sets `profiles.role=clinic`.
6. Redirect to `/dashboard/clinic`.

See `docs/nexus/hairaudit-nexus-account-claim.md` for token security details (shared `HA_ACCOUNT_CLAIM_TOKEN_SECRET`).

## Access policy

| Clinic type | Access path |
|-------------|-------------|
| Standalone (`HA_ALLOW_STANDALONE_CLINIC_SIGNUP=true`) | Local `participation_approval_status` |
| Network (`external_clinic_id` + clinic membership) | Nexus approval + entitlements |
| Suspended/revoked network clinic | Blocked |
| Strict mode (`HA_REQUIRE_NEXUS_FOR_PROFESSIONAL_UPLOAD=true`) | Standalone clinics blocked for upload actions |

Patient and doctor Nexus flows are unchanged.

## Database objects (migration `20260702160000`)

- `hairaudit_nexus_external_clinics`
- `hairaudit_nexus_clinic_memberships`
- `hairaudit_nexus_clinic_entitlements`
- Extended `hairaudit_account_claim_tokens` (`claim_subject_type`, `clinic_profile_id`, `global_clinic_id`)
- Extended `hairaudit_account_link_audit` (clinic columns)
- Unique partial index on `clinic_profiles.external_clinic_id`

All Nexus/claim tables: RLS enabled, **service_role only**.

## Future FI OS sender expectations

FI OS should:

- Use stable `globalClinicId` / `fiClinicId` as the durable anchor across re-provisions.
- Send idempotent upserts; approval/entitlement changes re-use the same `globalClinicId`.
- Include `primaryContactEmail` for invite delivery only — not for identity matching.
- Expect HairAudit to return 409 on email-only conflicts so FI OS can reconcile manually.

HairAudit does **not** implement the FI OS sender in HA-NEXUS-3.

## Tests

```bash
pnpm test:nexus          # includes nexusClinicProvisioning.test.ts
pnpm test:account-claim-ui
```
