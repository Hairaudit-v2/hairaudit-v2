import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  HaNexusClinicEntitlementRow,
  HaNexusClinicMembershipRow,
  HaNexusEntitlementRow,
  HaNexusExternalClinicRow,
  HaNexusExternalProfessionalRow,
  HaNexusMembershipRow,
} from "@/lib/nexus/nexusProvisioningTypes";

type AuditRow = {
  id: string;
  global_professional_id: string;
  global_clinic_id: string | null;
  entity_type: string;
  action_type: string;
  payload: Record<string, unknown> | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  result: string;
  failure_reason: string | null;
  created_at: string;
};

type DoctorProfileRow = {
  id: string;
  linked_user_id: string | null;
  doctor_name: string;
  doctor_email: string | null;
  external_provider_id: string | null;
  participation_approval_status: string;
  participation_status: string;
  created_at: string;
  updated_at: string;
};

type ClinicProfileRow = {
  id: string;
  linked_user_id: string | null;
  clinic_name: string;
  clinic_email: string | null;
  external_clinic_id: string | null;
  participation_approval_status: string;
  participation_status: string;
  created_at: string;
  updated_at: string;
};

type ClaimTokenRow = {
  id: string;
  token_hash: string;
  claim_subject_type: "doctor" | "clinic";
  global_professional_id: string | null;
  global_clinic_id: string | null;
  doctor_profile_id: string | null;
  clinic_profile_id: string | null;
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

type LinkAuditRow = {
  id: string;
  doctor_profile_id: string | null;
  clinic_profile_id: string | null;
  global_professional_id: string | null;
  global_clinic_id: string | null;
  linked_user_id: string | null;
  action: string;
  actor_type: string;
  actor_user_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ProfileRow = {
  id: string;
  role: string;
  email: string | null;
  updated_at: string;
};

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export type HaNexusTestStore = {
  professionals: Map<string, HaNexusExternalProfessionalRow>;
  memberships: Map<string, HaNexusMembershipRow>;
  entitlements: Map<string, HaNexusEntitlementRow>;
  externalClinics: Map<string, HaNexusExternalClinicRow>;
  clinicMemberships: Map<string, HaNexusClinicMembershipRow>;
  clinicEntitlements: Map<string, HaNexusClinicEntitlementRow>;
  doctorProfiles: Map<string, DoctorProfileRow>;
  clinicProfiles: Map<string, ClinicProfileRow>;
  claimTokens: Map<string, ClaimTokenRow>;
  linkAudits: LinkAuditRow[];
  profiles: Map<string, ProfileRow>;
  audits: AuditRow[];
  client: SupabaseClient;
};

function clinicEntitlementStoreKey(globalId: string, key: string): string {
  return `clinic::${globalId}::${key}`;
}

function entitlementStoreKey(globalId: string, key: string): string {
  return `${globalId}::${key}`;
}

export function createHaNexusTestStore(): HaNexusTestStore {
  const store: HaNexusTestStore = {
    professionals: new Map(),
    memberships: new Map(),
    entitlements: new Map(),
    externalClinics: new Map(),
    clinicMemberships: new Map(),
    clinicEntitlements: new Map(),
    doctorProfiles: new Map(),
    clinicProfiles: new Map(),
    claimTokens: new Map(),
    linkAudits: [],
    profiles: new Map(),
    audits: [],
    client: null as unknown as SupabaseClient,
  };

  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    const notFilters: [string, unknown][] = [];
    let opts: { count?: string; head?: boolean } | undefined;
    let pendingUpdate: Record<string, unknown> | null = null;
    let queryMode: "select" | "update" = "select";
    let limitCount: number | null = null;
    let orderCol: string | null = null;
    let orderAsc = true;

    const api = {
      select(_cols: string, selectOpts?: { count?: string; head?: boolean }) {
        queryMode = "select";
        opts = selectOpts;
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return api;
      },
      ilike(col: string, val: unknown) {
        filters.push([`ilike:${col}`, val]);
        return api;
      },
      is(col: string, val: unknown) {
        filters.push([`is:${col}`, val]);
        return api;
      },
      not(col: string, _op: string, val: unknown) {
        notFilters.push([col, val]);
        return api;
      },
      order(col: string, orderOpts?: { ascending?: boolean }) {
        orderCol = col;
        orderAsc = orderOpts?.ascending !== false;
        return api;
      },
      limit(n: number) {
        limitCount = n;
        return api;
      },
      maybeSingle: async () => {
        const result = resolveOne(table, filters, notFilters, orderCol, orderAsc, limitCount);
        filters.length = 0;
        notFilters.length = 0;
        orderCol = null;
        limitCount = null;
        queryMode = "select";
        pendingUpdate = null;
        return result;
      },
      single: async () => {
        const result = resolveOne(table, filters, notFilters, orderCol, orderAsc, limitCount);
        filters.length = 0;
        notFilters.length = 0;
        orderCol = null;
        limitCount = null;
        queryMode = "select";
        pendingUpdate = null;
        if (result.error) return result;
        if (!result.data) return { data: null, error: { message: "not found" } };
        return result;
      },
      insert(row: Record<string, unknown> | Record<string, unknown>[]) {
        const rows = Array.isArray(row) ? row : [row];
        const inserted = rows.map((r) => insertRow(table, r));
        filters.length = 0;
        return {
          select: () => ({
            single: async () => ({ data: inserted[0], error: null }),
          }),
          then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve({ data: inserted, error: null }).then(onFulfilled, onRejected),
        };
      },
      upsert: async (row: Record<string, unknown>) => {
        upsertRow(table, row);
        filters.length = 0;
        return { data: row, error: null };
      },
      update(patch: Record<string, unknown>) {
        pendingUpdate = patch;
        queryMode = "update";
        return api;
      },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        if (queryMode === "update" && pendingUpdate) {
          updateRows(table, filters, pendingUpdate);
          filters.length = 0;
          pendingUpdate = null;
          queryMode = "select";
          return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
        }
        return Promise.resolve(resolveMany(table, filters, notFilters, orderCol, orderAsc, limitCount)).then(onFulfilled, onRejected);
      },
    };

    return api;
  };

  function matches(row: Record<string, unknown>, rowFilters: [string, unknown][]): boolean {
    for (const [col, val] of rowFilters) {
      if (col.startsWith("is:")) {
        const key = col.slice(3);
        if ((row[key] ?? null) !== val) return false;
        continue;
      }
      if (col.startsWith("ilike:")) {
        const key = col.slice(6);
        const rowVal = String(row[key] ?? "").toLowerCase();
        const filterVal = String(val ?? "").toLowerCase();
        if (rowVal !== filterVal) return false;
        continue;
      }
      if (row[col] !== val) return false;
    }
    return true;
  }

  function matchesNot(row: Record<string, unknown>, rowNotFilters: [string, unknown][]): boolean {
    for (const [col, val] of rowNotFilters) {
      if (val === null && (row[col] ?? null) === null) return false;
      if (row[col] === val) return false;
    }
    return true;
  }

  function sortRows<T extends Record<string, unknown>>(rows: T[], col: string | null, asc: boolean): T[] {
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      if (av === bv) return 0;
      if (av == null) return asc ? -1 : 1;
      if (bv == null) return asc ? 1 : -1;
      return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }

  function resolveOne(
    table: string,
    rowFilters: [string, unknown][],
    rowNotFilters: [string, unknown][],
    orderCol: string | null,
    orderAsc: boolean,
    limitCount: number | null
  ) {
    if (table === "hairaudit_nexus_external_professionals") {
      const gid = rowFilters.find(([c]) => c === "global_professional_id")?.[1] as string;
      return { data: store.professionals.get(gid) ?? null, error: null };
    }
    if (table === "hairaudit_nexus_memberships") {
      const gid = rowFilters.find(([c]) => c === "global_professional_id")?.[1] as string;
      return { data: store.memberships.get(gid) ?? null, error: null };
    }
    if (table === "hairaudit_nexus_external_clinics") {
      const gid = rowFilters.find(([c]) => c === "global_clinic_id")?.[1] as string;
      return { data: store.externalClinics.get(gid) ?? null, error: null };
    }
    if (table === "hairaudit_nexus_clinic_memberships") {
      const gid = rowFilters.find(([c]) => c === "global_clinic_id")?.[1] as string;
      return { data: store.clinicMemberships.get(gid) ?? null, error: null };
    }
    if (table === "doctor_profiles") {
      let rows = [...store.doctorProfiles.values()].filter((row) =>
        matches(row as unknown as Record<string, unknown>, rowFilters) &&
        matchesNot(row as unknown as Record<string, unknown>, rowNotFilters)
      );
      rows = sortRows(rows as unknown as Record<string, unknown>[], orderCol, orderAsc) as typeof rows;
      if (limitCount != null) rows = rows.slice(0, limitCount);
      return { data: rows[0] ?? null, error: null };
    }
    if (table === "clinic_profiles") {
      let rows = [...store.clinicProfiles.values()].filter((row) =>
        matches(row as unknown as Record<string, unknown>, rowFilters) &&
        matchesNot(row as unknown as Record<string, unknown>, rowNotFilters)
      );
      rows = sortRows(rows as unknown as Record<string, unknown>[], orderCol, orderAsc) as typeof rows;
      if (limitCount != null) rows = rows.slice(0, limitCount);
      return { data: rows[0] ?? null, error: null };
    }
    if (table === "hairaudit_account_claim_tokens") {
      let rows = [...store.claimTokens.values()].filter((row) =>
        matches(row as unknown as Record<string, unknown>, rowFilters) &&
        matchesNot(row as unknown as Record<string, unknown>, rowNotFilters)
      );
      rows = sortRows(rows as unknown as Record<string, unknown>[], orderCol, orderAsc) as typeof rows;
      if (limitCount != null) rows = rows.slice(0, limitCount);
      return { data: rows[0] ?? null, error: null };
    }
    if (table === "profiles") {
      for (const row of store.profiles.values()) {
        if (matches(row as unknown as Record<string, unknown>, rowFilters)) {
          return { data: row, error: null };
        }
      }
      return { data: null, error: null };
    }
    if (table === "hairaudit_nexus_entitlements") {
      for (const row of store.entitlements.values()) {
        if (matches(row as unknown as Record<string, unknown>, rowFilters)) {
          return { data: row, error: null };
        }
      }
      return { data: null, error: null };
    }
    if (table === "hairaudit_nexus_clinic_entitlements") {
      for (const row of store.clinicEntitlements.values()) {
        if (matches(row as unknown as Record<string, unknown>, rowFilters)) {
          return { data: row, error: null };
        }
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }

  function resolveMany(
    table: string,
    rowFilters: [string, unknown][],
    rowNotFilters: [string, unknown][],
    orderCol: string | null,
    orderAsc: boolean,
    limitCount: number | null,
    selectOpts?: { count?: string; head?: boolean }
  ) {
    if (table === "hairaudit_nexus_provisioning_audit" && selectOpts?.head) {
      const gid =
        (rowFilters.find(([c]) => c === "global_professional_id")?.[1] as string | undefined) ??
        (rowFilters.find(([c]) => c === "global_clinic_id")?.[1] as string | undefined);
      const count = store.audits.filter(
        (a) => a.global_professional_id === gid || a.global_clinic_id === gid
      ).length;
      return { count, error: null };
    }

    if (table === "hairaudit_nexus_external_clinics") {
      const gid = rowFilters.find(([c]) => c === "global_clinic_id")?.[1] as string;
      return { data: store.externalClinics.get(gid) ?? null, error: null };
    }
    if (table === "hairaudit_nexus_clinic_memberships") {
      const gid = rowFilters.find(([c]) => c === "global_clinic_id")?.[1] as string;
      return { data: store.clinicMemberships.get(gid) ?? null, error: null };
    }
    if (table === "hairaudit_nexus_clinic_entitlements") {
      const rows = [...store.clinicEntitlements.values()].filter((r) =>
        matches(r as unknown as Record<string, unknown>, rowFilters)
      );
      return { data: rows, error: null };
    }

    if (table === "hairaudit_nexus_entitlements") {
      const rows = [...store.entitlements.values()].filter((r) =>
        matches(r as unknown as Record<string, unknown>, rowFilters)
      );
      return { data: rows, error: null };
    }

    if (table === "hairaudit_account_claim_tokens") {
      let rows = [...store.claimTokens.values()].filter(
        (r) =>
          matches(r as unknown as Record<string, unknown>, rowFilters) &&
          matchesNot(r as unknown as Record<string, unknown>, rowNotFilters)
      );
      rows = sortRows(rows as unknown as Record<string, unknown>[], orderCol, orderAsc) as typeof rows;
      if (limitCount != null) rows = rows.slice(0, limitCount);
      return { data: rows, error: null };
    }

    return { data: [], error: null };
  }

  function insertRow(table: string, row: Record<string, unknown>) {
    const ts = nowIso();
    if (table === "doctor_profiles") {
      const id = newId();
      const created: DoctorProfileRow = {
        id,
        linked_user_id: (row.linked_user_id as string | null) ?? null,
        doctor_name: String(row.doctor_name ?? "Network Professional"),
        doctor_email: (row.doctor_email as string | null) ?? null,
        external_provider_id: (row.external_provider_id as string | null) ?? null,
        participation_approval_status: String(row.participation_approval_status ?? "pending_review"),
        participation_status: String(row.participation_status ?? "not_started"),
        created_at: ts,
        updated_at: ts,
      };
      store.doctorProfiles.set(id, created);
      return created;
    }
    if (table === "clinic_profiles") {
      const id = newId();
      const created: ClinicProfileRow = {
        id,
        linked_user_id: (row.linked_user_id as string | null) ?? null,
        clinic_name: String(row.clinic_name ?? "Network Clinic"),
        clinic_email: (row.clinic_email as string | null) ?? null,
        external_clinic_id: (row.external_clinic_id as string | null) ?? null,
        participation_approval_status: String(row.participation_approval_status ?? "pending_review"),
        participation_status: String(row.participation_status ?? "not_started"),
        created_at: ts,
        updated_at: ts,
      };
      store.clinicProfiles.set(id, created);
      return created;
    }
    if (table === "hairaudit_nexus_entitlements") {
      const gid = String(row.global_professional_id);
      const key = String(row.entitlement_key);
      const id = newId();
      const created: HaNexusEntitlementRow = {
        id,
        global_professional_id: gid,
        entitlement_key: key,
        active: Boolean(row.active ?? true),
        nexus_created: Boolean(row.nexus_created ?? true),
        revoked_at: (row.revoked_at as string | null) ?? null,
        created_at: ts,
        updated_at: ts,
      };
      store.entitlements.set(entitlementStoreKey(gid, key), created);
      return created;
    }
    if (table === "hairaudit_nexus_clinic_entitlements") {
      const gid = String(row.global_clinic_id);
      const key = String(row.entitlement_key);
      const id = newId();
      const created: HaNexusClinicEntitlementRow = {
        id,
        global_clinic_id: gid,
        entitlement_key: key,
        active: Boolean(row.active ?? true),
        nexus_created: Boolean(row.nexus_created ?? true),
        revoked_at: (row.revoked_at as string | null) ?? null,
        created_at: ts,
        updated_at: ts,
      };
      store.clinicEntitlements.set(clinicEntitlementStoreKey(gid, key), created);
      return created;
    }
    if (table === "hairaudit_nexus_provisioning_audit") {
      const audit = {
        id: newId(),
        global_professional_id: String(row.global_professional_id ?? row.global_clinic_id ?? ""),
        global_clinic_id: (row.global_clinic_id as string | null) ?? null,
        entity_type: String(row.entity_type ?? "doctor"),
        action_type: String(row.action_type),
        payload: (row.payload as Record<string, unknown>) ?? null,
        before_state: (row.before_state as Record<string, unknown>) ?? null,
        after_state: (row.after_state as Record<string, unknown>) ?? null,
        result: String(row.result),
        failure_reason: (row.failure_reason as string | null) ?? null,
        created_at: ts,
      };
      store.audits.push(audit);
      return audit;
    }
    if (table === "hairaudit_account_claim_tokens") {
      const id = newId();
      const subjectType = (row.claim_subject_type as "doctor" | "clinic") ?? "doctor";
      const created: ClaimTokenRow = {
        id,
        token_hash: String(row.token_hash),
        claim_subject_type: subjectType,
        global_professional_id: (row.global_professional_id as string | null) ?? null,
        global_clinic_id: (row.global_clinic_id as string | null) ?? null,
        doctor_profile_id: (row.doctor_profile_id as string | null) ?? null,
        clinic_profile_id: (row.clinic_profile_id as string | null) ?? null,
        external_professional_id: (row.external_professional_id as string | null) ?? null,
        intended_email_snapshot: String(row.intended_email_snapshot),
        role_snapshot: String(row.role_snapshot ?? subjectType),
        expires_at: String(row.expires_at),
        claimed_at: (row.claimed_at as string | null) ?? null,
        revoked_at: (row.revoked_at as string | null) ?? null,
        created_by_system: String(row.created_by_system ?? "nexus"),
        created_by_user_id: (row.created_by_user_id as string | null) ?? null,
        consumed_by_user_id: (row.consumed_by_user_id as string | null) ?? null,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        created_at: ts,
        updated_at: ts,
      };
      store.claimTokens.set(created.token_hash, created);
      return created;
    }
    if (table === "hairaudit_account_link_audit") {
      const created: LinkAuditRow = {
        id: newId(),
        doctor_profile_id: (row.doctor_profile_id as string | null) ?? null,
        clinic_profile_id: (row.clinic_profile_id as string | null) ?? null,
        global_professional_id: (row.global_professional_id as string | null) ?? null,
        global_clinic_id: (row.global_clinic_id as string | null) ?? null,
        linked_user_id: (row.linked_user_id as string | null) ?? null,
        action: String(row.action),
        actor_type: String(row.actor_type),
        actor_user_id: (row.actor_user_id as string | null) ?? null,
        reason: (row.reason as string | null) ?? null,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        created_at: ts,
      };
      store.linkAudits.push(created);
      return created;
    }
    if (table === "profiles") {
      const id = String(row.id);
      const created: ProfileRow = {
        id,
        role: String(row.role ?? "patient"),
        email: (row.email as string | null) ?? null,
        updated_at: ts,
      };
      store.profiles.set(id, created);
      return created;
    }
    return row;
  }

  function upsertRow(table: string, row: Record<string, unknown>) {
    const ts = nowIso();
    if (table === "hairaudit_nexus_external_professionals") {
      const gid = String(row.global_professional_id);
      const existing = store.professionals.get(gid);
      const next: HaNexusExternalProfessionalRow = {
        id: existing?.id ?? newId(),
        global_professional_id: gid,
        source_system: String(row.source_system ?? "iiohr"),
        source_external_id: (row.source_external_id as string | null) ?? null,
        email: String(row.email),
        full_name: (row.full_name as string | null) ?? null,
        professional_role: String(row.professional_role),
        training_status: (row.training_status as string | null) ?? null,
        certification_level: (row.certification_level as string | null) ?? null,
        doctor_profile_id: (row.doctor_profile_id as string | null) ?? null,
        nexus_created: Boolean(row.nexus_created ?? true),
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };
      store.professionals.set(gid, next);
    }
    if (table === "hairaudit_nexus_memberships") {
      const gid = String(row.global_professional_id);
      const existing = store.memberships.get(gid);
      const next: HaNexusMembershipRow = {
        id: existing?.id ?? newId(),
        global_professional_id: gid,
        doctor_profile_id: (row.doctor_profile_id as string | null) ?? null,
        approval_status: String(row.approval_status ?? "pending"),
        provision_status: String(row.provision_status ?? "provisioned"),
        revoked_at: (row.revoked_at as string | null) ?? null,
        suspended_at: (row.suspended_at as string | null) ?? null,
        nexus_created: Boolean(row.nexus_created ?? true),
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };
      store.memberships.set(gid, next);
    }
    if (table === "hairaudit_nexus_external_clinics") {
      const gid = String(row.global_clinic_id);
      const existing = store.externalClinics.get(gid);
      const next: HaNexusExternalClinicRow = {
        id: existing?.id ?? newId(),
        global_clinic_id: gid,
        source_system: String(row.source_system ?? "iiohr"),
        source_external_id: (row.source_external_id as string | null) ?? null,
        fi_tenant_id: (row.fi_tenant_id as string | null) ?? null,
        fi_clinic_id: (row.fi_clinic_id as string | null) ?? null,
        clinic_name: String(row.clinic_name),
        primary_contact_email: String(row.primary_contact_email),
        primary_contact_name: (row.primary_contact_name as string | null) ?? null,
        country: (row.country as string | null) ?? null,
        region: (row.region as string | null) ?? null,
        clinic_profile_id: (row.clinic_profile_id as string | null) ?? null,
        claimed_by_user_id: (row.claimed_by_user_id as string | null) ?? null,
        nexus_created: Boolean(row.nexus_created ?? true),
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };
      store.externalClinics.set(gid, next);
    }
    if (table === "hairaudit_nexus_clinic_memberships") {
      const gid = String(row.global_clinic_id);
      const existing = store.clinicMemberships.get(gid);
      const next: HaNexusClinicMembershipRow = {
        id: existing?.id ?? newId(),
        global_clinic_id: gid,
        clinic_profile_id: (row.clinic_profile_id as string | null) ?? null,
        approval_status: String(row.approval_status ?? "pending"),
        provision_status: String(row.provision_status ?? "active"),
        revoked_at: (row.revoked_at as string | null) ?? null,
        suspended_at: (row.suspended_at as string | null) ?? null,
        nexus_created: Boolean(row.nexus_created ?? true),
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };
      store.clinicMemberships.set(gid, next);
    }
  }

  function updateRows(table: string, rowFilters: [string, unknown][], patch: Record<string, unknown>) {
    if (table === "doctor_profiles") {
      for (const [id, row] of store.doctorProfiles) {
        if (!matches(row as unknown as Record<string, unknown>, rowFilters)) continue;
        store.doctorProfiles.set(id, {
          ...row,
          ...patch,
          updated_at: nowIso(),
        } as DoctorProfileRow);
      }
    }
    if (table === "clinic_profiles") {
      for (const [id, row] of store.clinicProfiles) {
        if (!matches(row as unknown as Record<string, unknown>, rowFilters)) continue;
        store.clinicProfiles.set(id, {
          ...row,
          ...patch,
          updated_at: nowIso(),
        } as ClinicProfileRow);
      }
    }
    if (table === "hairaudit_nexus_external_clinics") {
      for (const [gid, row] of store.externalClinics) {
        if (!matches(row as unknown as Record<string, unknown>, rowFilters)) continue;
        store.externalClinics.set(gid, {
          ...row,
          ...patch,
          updated_at: nowIso(),
        } as HaNexusExternalClinicRow);
      }
    }
    if (table === "hairaudit_nexus_entitlements") {
      for (const [key, row] of store.entitlements) {
        if (!matches(row as unknown as Record<string, unknown>, rowFilters)) continue;
        store.entitlements.set(key, {
          ...row,
          active: patch.active !== undefined ? Boolean(patch.active) : row.active,
          revoked_at: (patch.revoked_at as string | null) ?? row.revoked_at,
          updated_at: nowIso(),
        });
      }
    }
    if (table === "hairaudit_nexus_clinic_entitlements") {
      for (const [key, row] of store.clinicEntitlements) {
        if (!matches(row as unknown as Record<string, unknown>, rowFilters)) continue;
        store.clinicEntitlements.set(key, {
          ...row,
          active: patch.active !== undefined ? Boolean(patch.active) : row.active,
          revoked_at: (patch.revoked_at as string | null) ?? row.revoked_at,
          updated_at: nowIso(),
        });
      }
    }
    if (table === "hairaudit_nexus_memberships") {
      for (const [gid, row] of store.memberships) {
        if (!matches(row as unknown as Record<string, unknown>, rowFilters)) continue;
        store.memberships.set(gid, {
          ...row,
          approval_status: String(patch.approval_status ?? row.approval_status),
          provision_status: String(patch.provision_status ?? row.provision_status),
          revoked_at: (patch.revoked_at as string | null) ?? row.revoked_at,
          suspended_at: (patch.suspended_at as string | null) ?? row.suspended_at,
          updated_at: nowIso(),
        });
      }
    }
    if (table === "hairaudit_account_claim_tokens") {
      for (const [hash, row] of store.claimTokens) {
        if (!matches(row as unknown as Record<string, unknown>, rowFilters)) continue;
        const updated = {
          ...row,
          ...patch,
          updated_at: nowIso(),
        } as ClaimTokenRow;
        store.claimTokens.delete(hash);
        store.claimTokens.set(updated.token_hash, updated);
      }
    }
    if (table === "profiles") {
      for (const [id, row] of store.profiles) {
        if (!matches(row as unknown as Record<string, unknown>, rowFilters)) continue;
        store.profiles.set(id, {
          ...row,
          ...patch,
          updated_at: nowIso(),
        } as ProfileRow);
      }
    }
  }

  store.client = { from } as unknown as SupabaseClient;
  return store;
}
