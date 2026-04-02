import { readFile } from "fs/promises";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LadderWithSteps } from "./competency";

const PUBLIC_PREFIX = "/training/doctors";

export type TrainingModuleCatalogFlags = {
  mandatory?: boolean;
  recommended?: boolean;
  /** Ladder `key` values from `training_competency_ladders`, for badges and suggestions */
  relatedCompetencyLadderKeys?: string[];
  /** When true, only listed auth user ids (trainees) see the module */
  requiresTrainerAssignment?: boolean;
  assignedAuthUserIds?: string[];
  /** Cohort ids from `training_module_cohort_assignments` (DB-backed) */
  assignedCohortIds?: string[];
};

export type TrainingModuleDefinition = {
  id: string;
  title: string;
  shortDescription: string;
  category: string;
  /** ISO date (YYYY-MM-DD) */
  lastUpdated: string;
  readOnlineUrl?: string | null;
  downloadUrl?: string | null;
  /** Optional static thumbnail/cover image shown in library cards */
  coverImageUrl?: string | null;
  /** Show “Week n” badge when trainee is in this week */
  recommendedForWeeks?: number[];
  /** draft modules are omitted from the library */
  status?: "approved" | "draft";
  flags?: TrainingModuleCatalogFlags;
};

export type TrainingModulesCatalogFile = {
  modules: TrainingModuleDefinition[];
};

export function isAllowedTrainingDoctorsPublicUrl(url: string): boolean {
  const u = url.trim();
  if (!u.startsWith(PUBLIC_PREFIX + "/")) return false;
  if (u.includes("://")) return false;
  if (u.includes("..")) return false;
  return true;
}

function normalizeModule(raw: unknown): TrainingModuleDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id || "").trim();
  const title = String(o.title || "").trim();
  const shortDescription = String(o.shortDescription ?? o.description ?? "").trim();
  const category = String(o.category || "General").trim() || "General";
  const lastUpdated = String(o.lastUpdated || "").trim();
  if (!id || !title || !lastUpdated) return null;

  const readOnlineUrl = o.readOnlineUrl != null ? String(o.readOnlineUrl).trim() || null : null;
  const downloadUrl = o.downloadUrl != null ? String(o.downloadUrl).trim() || null : null;
  const coverImageUrl = o.coverImageUrl != null ? String(o.coverImageUrl).trim() || null : null;
  if (readOnlineUrl && !isAllowedTrainingDoctorsPublicUrl(readOnlineUrl)) return null;
  if (downloadUrl && !isAllowedTrainingDoctorsPublicUrl(downloadUrl)) return null;
  if (coverImageUrl && !isAllowedTrainingDoctorsPublicUrl(coverImageUrl)) return null;

  const status = o.status === "draft" ? "draft" : "approved";
  let recommendedForWeeks: number[] | undefined;
  if (Array.isArray(o.recommendedForWeeks)) {
    recommendedForWeeks = o.recommendedForWeeks
      .map((n) => (typeof n === "number" ? n : parseInt(String(n), 10)))
      .filter((n) => n >= 1 && n <= 12);
  }

  const flagsRaw = o.flags;
  let flags: TrainingModuleCatalogFlags | undefined;
  if (flagsRaw && typeof flagsRaw === "object") {
    const f = flagsRaw as Record<string, unknown>;
    flags = {
      mandatory: Boolean(f.mandatory),
      recommended: Boolean(f.recommended),
      relatedCompetencyLadderKeys: Array.isArray(f.relatedCompetencyLadderKeys)
        ? f.relatedCompetencyLadderKeys.map((k) => String(k).trim()).filter(Boolean)
        : undefined,
      requiresTrainerAssignment: Boolean(f.requiresTrainerAssignment),
      assignedAuthUserIds: Array.isArray(f.assignedAuthUserIds)
        ? f.assignedAuthUserIds.map((k) => String(k).trim()).filter(Boolean)
        : undefined,
    };
  }

  return {
    id,
    title,
    shortDescription,
    category,
    lastUpdated,
    readOnlineUrl,
    downloadUrl,
    coverImageUrl,
    recommendedForWeeks,
    status,
    flags,
  };
}

export async function loadTrainingModulesCatalogFromJson(): Promise<TrainingModuleDefinition[]> {
  const filePath = path.join(process.cwd(), "public", "training", "doctors", "modules.json");
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as TrainingModulesCatalogFile | unknown;
    const list = Array.isArray(parsed)
      ? (parsed as unknown[])
      : Array.isArray((parsed as TrainingModulesCatalogFile)?.modules)
        ? (parsed as TrainingModulesCatalogFile).modules
        : [];
    const out: TrainingModuleDefinition[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const m = normalizeModule(item);
      if (!m || m.status === "draft") continue;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    out.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated) || a.title.localeCompare(b.title));
    return out;
  } catch {
    return [];
  }
}

/** @deprecated Prefer loadTrainingModulesCatalogMerged(supabase) */
export async function loadTrainingModulesCatalog(): Promise<TrainingModuleDefinition[]> {
  return loadTrainingModulesCatalogFromJson();
}

type DbModuleRow = {
  id: string;
  title: string;
  short_description: string;
  category: string;
  last_updated: string;
  read_online_url: string | null;
  download_url: string | null;
  cover_image_url: string | null;
  status: string;
  mandatory: boolean;
  recommended: boolean;
  recommended_weeks: number[] | null;
  related_competency_ladder_keys: string[] | null;
  requires_assignment: boolean;
};

function dbRowToDefinition(
  row: DbModuleRow,
  userIds: string[],
  cohortIds: string[]
): TrainingModuleDefinition | null {
  const lastUpdated = String(row.last_updated || "").slice(0, 10);
  if (!row.id?.trim() || !row.title?.trim() || !lastUpdated) return null;
  const readOnlineUrl = row.read_online_url?.trim() || null;
  const downloadUrl = row.download_url?.trim() || null;
  const coverImageUrl = row.cover_image_url?.trim() || null;
  if (readOnlineUrl && !isAllowedTrainingDoctorsPublicUrl(readOnlineUrl)) return null;
  if (downloadUrl && !isAllowedTrainingDoctorsPublicUrl(downloadUrl)) return null;
  if (coverImageUrl && !isAllowedTrainingDoctorsPublicUrl(coverImageUrl)) return null;

  const weeks = Array.isArray(row.recommended_weeks)
    ? row.recommended_weeks.map((n) => Number(n)).filter((n) => n >= 1 && n <= 12)
    : [];
  const ladderKeys = Array.isArray(row.related_competency_ladder_keys)
    ? row.related_competency_ladder_keys.map((k) => String(k).trim()).filter(Boolean)
    : undefined;

  const flags: TrainingModuleCatalogFlags = {
    mandatory: row.mandatory,
    recommended: row.recommended,
    relatedCompetencyLadderKeys: ladderKeys?.length ? ladderKeys : undefined,
    requiresTrainerAssignment: row.requires_assignment,
    assignedAuthUserIds: userIds.length ? userIds : undefined,
    assignedCohortIds: cohortIds.length ? cohortIds : undefined,
  };

  return {
    id: row.id.trim(),
    title: row.title.trim(),
    shortDescription: row.short_description?.trim() || "",
    category: row.category?.trim() || "General",
    lastUpdated,
    readOnlineUrl,
    downloadUrl,
    coverImageUrl,
    recommendedForWeeks: weeks.length ? weeks : undefined,
    status: row.status === "draft" ? "draft" : "approved",
    flags,
  };
}

/**
 * DB modules (RLS-aware) override JSON entries with the same id. Unmatched JSON modules remain as fallback.
 */
export async function loadTrainingModulesCatalogMerged(supabase: SupabaseClient): Promise<TrainingModuleDefinition[]> {
  const { data: rows, error } = await supabase.from("training_modules").select("*");
  if (error) {
    return loadTrainingModulesCatalogFromJson();
  }
  if (!rows?.length) {
    return loadTrainingModulesCatalogFromJson();
  }

  const dbList = rows as DbModuleRow[];
  const ids = dbList.map((r) => r.id);
  const [{ data: userAssigns }, { data: cohortAssigns }] = await Promise.all([
    supabase.from("training_module_user_assignments").select("module_id, user_id").in("module_id", ids),
    supabase.from("training_module_cohort_assignments").select("module_id, cohort_id").in("module_id", ids),
  ]);

  const usersByModule = new Map<string, string[]>();
  for (const r of userAssigns ?? []) {
    const mid = (r as { module_id: string }).module_id;
    const uid = (r as { user_id: string }).user_id;
    const list = usersByModule.get(mid) ?? [];
    list.push(uid);
    usersByModule.set(mid, list);
  }
  const cohortsByModule = new Map<string, string[]>();
  for (const r of cohortAssigns ?? []) {
    const mid = (r as { module_id: string }).module_id;
    const cid = (r as { cohort_id: string }).cohort_id;
    const list = cohortsByModule.get(mid) ?? [];
    list.push(cid);
    cohortsByModule.set(mid, list);
  }

  const fromDb: TrainingModuleDefinition[] = [];
  const dbIds = new Set<string>();
  for (const row of dbList) {
    const m = dbRowToDefinition(
      row,
      usersByModule.get(row.id) ?? [],
      cohortsByModule.get(row.id) ?? []
    );
    if (!m) continue;
    if (m.status === "draft") continue;
    dbIds.add(m.id);
    fromDb.push(m);
  }

  const jsonMods = await loadTrainingModulesCatalogFromJson();
  const fromJson = jsonMods.filter((m) => !dbIds.has(m.id));
  const merged = [...fromDb, ...fromJson];
  merged.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated) || a.title.localeCompare(b.title));
  return merged;
}

export function filterModulesForViewer(
  modules: TrainingModuleDefinition[],
  ctx: { userId: string; isStaff: boolean; traineeCohortIds?: string[] }
): TrainingModuleDefinition[] {
  const cohortSet = ctx.traineeCohortIds ?? [];
  return modules.filter((m) => {
    const req = m.flags?.requiresTrainerAssignment;
    if (!req) return true;
    if (ctx.isStaff) return true;
    const ids = m.flags?.assignedAuthUserIds ?? [];
    const cids = m.flags?.assignedCohortIds ?? [];
    if (ids.includes(ctx.userId)) return true;
    if (cids.length > 0 && cohortSet.some((c) => cids.includes(c))) return true;
    return false;
  });
}

/** Ladder keys tied to metrics suggestions or incomplete target milestones — for optional “related study” hints. */
export function collectLadderKeysForTrainingHints(
  laddersWithSteps: LadderWithSteps[],
  suggestedStepIds: string[],
  achievedStepIds: Set<string>
): string[] {
  const stepToLadderKey = new Map<string, string>();
  for (const l of laddersWithSteps) {
    for (const s of l.steps) stepToLadderKey.set(s.id, l.key);
  }
  const keys = new Set<string>();
  for (const id of suggestedStepIds) {
    const k = stepToLadderKey.get(id);
    if (k) keys.add(k);
  }
  for (const l of laddersWithSteps) {
    const targets = l.steps.filter((s) => s.is_target);
    if (!targets.length) continue;
    if (targets.some((t) => !achievedStepIds.has(t.id))) keys.add(l.key);
  }
  return [...keys];
}
