import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  HaNexusEntitlementRow,
  HaNexusExternalProfessionalRow,
  HaNexusMembershipRow,
} from "@/lib/nexus/nexusProvisioningTypes";

type AuditRow = {
  id: string;
  global_professional_id: string;
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
  doctorProfiles: Map<string, DoctorProfileRow>;
  audits: AuditRow[];
  client: SupabaseClient;
};

function entitlementStoreKey(globalId: string, key: string): string {
  return `${globalId}::${key}`;
}

export function createHaNexusTestStore(): HaNexusTestStore {
  const store: HaNexusTestStore = {
    professionals: new Map(),
    memberships: new Map(),
    entitlements: new Map(),
    doctorProfiles: new Map(),
    audits: [],
    client: null as unknown as SupabaseClient,
  };

  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    let opts: { count?: string; head?: boolean } | undefined;
    let pendingUpdate: Record<string, unknown> | null = null;
    let queryMode: "select" | "update" = "select";

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
      is(col: string, val: unknown) {
        filters.push([`is:${col}`, val]);
        return api;
      },
      order(_col: string, _opts?: { ascending?: boolean }) {
        return api;
      },
      maybeSingle: async () => {
        const result = resolveOne(table, filters);
        filters.length = 0;
        queryMode = "select";
        pendingUpdate = null;
        return result;
      },
      single: async () => {
        const result = resolveOne(table, filters);
        filters.length = 0;
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
        return Promise.resolve(resolveMany(table, filters, opts)).then(onFulfilled, onRejected);
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
      if (row[col] !== val) return false;
    }
    return true;
  }

  function resolveOne(table: string, rowFilters: [string, unknown][]) {
    if (table === "hairaudit_nexus_external_professionals") {
      const gid = rowFilters.find(([c]) => c === "global_professional_id")?.[1] as string;
      return { data: store.professionals.get(gid) ?? null, error: null };
    }
    if (table === "hairaudit_nexus_memberships") {
      const gid = rowFilters.find(([c]) => c === "global_professional_id")?.[1] as string;
      return { data: store.memberships.get(gid) ?? null, error: null };
    }
    if (table === "doctor_profiles") {
      for (const row of store.doctorProfiles.values()) {
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
    return { data: null, error: null };
  }

  function resolveMany(
    table: string,
    rowFilters: [string, unknown][],
    selectOpts?: { count?: string; head?: boolean }
  ) {
    if (table === "hairaudit_nexus_provisioning_audit" && selectOpts?.head) {
      const gid = rowFilters.find(([c]) => c === "global_professional_id")?.[1] as string;
      const count = store.audits.filter((a) => a.global_professional_id === gid).length;
      return { count, error: null };
    }

    if (table === "hairaudit_nexus_entitlements") {
      const rows = [...store.entitlements.values()].filter((r) =>
        matches(r as unknown as Record<string, unknown>, rowFilters)
      );
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
    if (table === "hairaudit_nexus_provisioning_audit") {
      const audit = {
        id: newId(),
        global_professional_id: String(row.global_professional_id),
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
  }

  store.client = { from } as unknown as SupabaseClient;
  return store;
}
