export const HA_NEXUS_ENTITLEMENT_KEYS = [
  "clinical_audit_upload",
  "case_creation",
  "report_access",
  "surgery_upload",
] as const;

export type HaNexusEntitlementKey = (typeof HA_NEXUS_ENTITLEMENT_KEYS)[number];

export function isHaNexusEntitlementKey(value: string): value is HaNexusEntitlementKey {
  return (HA_NEXUS_ENTITLEMENT_KEYS as readonly string[]).includes(value);
}

export function validateHaNexusEntitlementKeys(
  keys: string[]
): { ok: true; keys: HaNexusEntitlementKey[] } | { ok: false; invalidKeys: string[] } {
  const invalidKeys = keys.filter((k) => !isHaNexusEntitlementKey(k.trim()));
  if (invalidKeys.length > 0) return { ok: false, invalidKeys };
  return { ok: true, keys: keys.map((k) => k.trim()) as HaNexusEntitlementKey[] };
}

export function dedupeEntitlementKeys(keys: HaNexusEntitlementKey[]): HaNexusEntitlementKey[] {
  return [...new Set(keys)];
}
