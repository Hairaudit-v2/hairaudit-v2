export type TraineeDuplicateHint = {
  kind: "email" | "auth_user" | "name" | "name_similar";
  key: string;
  doctorIds: string[];
  description: string;
};

export type TraineeDuplicateRow = {
  id: string;
  full_name: string;
  email: string | null;
  auth_user_id: string | null;
};

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** first + last token key for loose duplicate detection */
function nameLooseKey(fullName: string): string | null {
  const parts = fullName.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[0]}|${parts[parts.length - 1]}`;
}

export function buildTraineeDuplicateHints(rows: TraineeDuplicateRow[]): TraineeDuplicateHint[] {
  const hints: TraineeDuplicateHint[] = [];

  const byEmail = new Map<string, string[]>();
  for (const r of rows) {
    const e = r.email?.trim().toLowerCase();
    if (!e) continue;
    const arr = byEmail.get(e) ?? [];
    arr.push(r.id);
    byEmail.set(e, arr);
  }
  for (const [k, ids] of byEmail) {
    if (ids.length > 1) {
      hints.push({
        kind: "email",
        key: k,
        doctorIds: ids,
        description: `Same email (${k})`,
      });
    }
  }

  const byAuth = new Map<string, string[]>();
  for (const r of rows) {
    const a = r.auth_user_id?.trim();
    if (!a) continue;
    const arr = byAuth.get(a) ?? [];
    arr.push(r.id);
    byAuth.set(a, arr);
  }
  for (const [k, ids] of byAuth) {
    if (ids.length > 1) {
      hints.push({
        kind: "auth_user",
        key: k,
        doctorIds: ids,
        description: `Same linked login (auth user)`,
      });
    }
  }

  const byExactName = new Map<string, string[]>();
  for (const r of rows) {
    const n = normName(r.full_name);
    if (!n) continue;
    const arr = byExactName.get(n) ?? [];
    arr.push(r.id);
    byExactName.set(n, arr);
  }
  for (const [k, ids] of byExactName) {
    if (ids.length > 1) {
      hints.push({
        kind: "name",
        key: k,
        doctorIds: ids,
        description: `Identical name (“${k}”)`,
      });
    }
  }

  const byLoose = new Map<string, string[]>();
  for (const r of rows) {
    const lk = nameLooseKey(r.full_name);
    if (!lk) continue;
    const arr = byLoose.get(lk) ?? [];
    arr.push(r.id);
    byLoose.set(lk, arr);
  }
  for (const [k, ids] of byLoose) {
    const uniqueNames = new Set(ids.map((id) => normName(rows.find((r) => r.id === id)?.full_name ?? "")));
    if (ids.length > 1 && uniqueNames.size > 1) {
      hints.push({
        kind: "name_similar",
        key: k,
        doctorIds: [...new Set(ids)],
        description: `Similar names (same first & last) — review for duplicates`,
      });
    }
  }

  return hints;
}
