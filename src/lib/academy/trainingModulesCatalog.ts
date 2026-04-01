import { readFile } from "fs/promises";
import path from "path";
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

export async function loadTrainingModulesCatalog(): Promise<TrainingModuleDefinition[]> {
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

export function filterModulesForViewer(
  modules: TrainingModuleDefinition[],
  ctx: { userId: string; isStaff: boolean }
): TrainingModuleDefinition[] {
  return modules.filter((m) => {
    const req = m.flags?.requiresTrainerAssignment;
    if (!req) return true;
    if (ctx.isStaff) return true;
    const ids = m.flags?.assignedAuthUserIds ?? [];
    return ids.length > 0 && ids.includes(ctx.userId);
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
