import { effectivePatientPhotoCategoryKey } from "@/lib/uploads/patientPhotoAuditMeta";

type UploadLike = {
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

function tokenize(upload: UploadLike): string {
  const type = String(upload.type ?? "").toLowerCase();
  // Do not use storage_path for patient_photo:* — path folder can disagree with DB after auditor reassignment.
  const path = type.startsWith("patient_photo:") ? "" : String(upload.storage_path ?? "").toLowerCase();
  const meta = upload.metadata ?? {};
  const category = String(meta.category ?? "").toLowerCase();
  const label = String(meta.label ?? "").toLowerCase();
  const originalName = String(meta.original_name ?? "").toLowerCase();
  return [type, path, category, label, originalName].join(" ");
}

function hasAny(s: string, needles: string[]) {
  return needles.some((n) => s.includes(n));
}

/**
 * When `upload.type` is `patient_photo:{key}`, use DB-backed category (metadata.category or type suffix)
 * before any fuzzy heuristics so corrected assignments and arbitrary valid keys are not overridden by path tokens.
 */
function patientPhotoCategoryLiteralFromUpload(upload: UploadLike): string | null {
  return effectivePatientPhotoCategoryKey(upload);
}

export function inferCanonicalPhotoCategory(upload: UploadLike): string {
  const literal = patientPhotoCategoryLiteralFromUpload(upload);
  if (literal) return literal;

  const s = tokenize(upload);

  // Graft tray categories (highest priority for graft handling analysis)
  if (hasAny(s, ["graft_tray"])) {
    if (hasAny(s, ["closeup", "close-up", "macro"])) return "graft_tray_closeup";
    if (hasAny(s, ["overview", "wide", "tray"])) return "graft_tray_overview";
    return "graft_tray_overview"; // default for graft_tray
  }
  // Doctor/Clinic graft tray categories (img_graft_tray_*)
  if (hasAny(s, ["img_graft_tray"])) {
    if (hasAny(s, ["closeup", "close-up", "macro"])) return "img_graft_tray_closeup";
    if (hasAny(s, ["overview", "wide", "tray"])) return "img_graft_tray_overview";
    return "img_graft_tray_overview";
  }
  // Other graft handling categories
  if (hasAny(s, ["graft_sorting"])) return "graft_sorting";
  if (hasAny(s, ["graft_hydration", "holding_solution"])) return "graft_hydration_solution";
  if (hasAny(s, ["graft_count", "count_board"])) return "graft_count_board";
  if (hasAny(s, ["graft_inspection"])) return "img_graft_inspection";
  if (hasAny(s, ["graft_microscopy"])) return "img_graft_microscopy";

  if (hasAny(s, ["donor", "occipital", "rear donor", "donor_rear"])) {
    if (hasAny(s, ["day0", "day-0", "intraop", "intra-op", "surgery day", "any_day0"])) {
      return "day0_donor";
    }
    if (hasAny(s, ["postop", "post-op", "healed", "month", "m1_", "m3_", "m6_"])) {
      return "postop_healed_donor";
    }
    return "preop_donor_rear";
  }

  if (hasAny(s, ["intraop", "intra-op"])) return "intraop";
  if (hasAny(s, ["day0", "day-0", "any_day0"])) return "day0_recipient";
  if (hasAny(s, ["postop", "post-op", "any_early_postop", "day7", "m1_", "m3_", "m6_"])) {
    return "postop_healed";
  }

  if (hasAny(s, ["current_front", "patient_current_front"])) return "current_front";
  if (hasAny(s, ["current_top", "patient_current_top"])) return "current_top";
  if (hasAny(s, ["patient_current_donor_rear"])) return "current_donor_rear";
  if (hasAny(s, ["patient_current_left"])) return "current_left";
  if (hasAny(s, ["patient_current_right"])) return "current_right";
  if (hasAny(s, ["patient_current_crown"])) return "current_crown";

  if (hasAny(s, ["preop_front", "front"])) return "preop_front";
  if (hasAny(s, ["preop_left", "left"])) return "preop_left";
  if (hasAny(s, ["preop_right", "right"])) return "preop_right";
  if (hasAny(s, ["preop_top", "top"])) return "preop_top";
  if (hasAny(s, ["preop_crown", "crown", "vertex"])) return "preop_crown";
  if (hasAny(s, ["any_preop", "pre-op", "preop"])) return "preop_misc";

  return "uncategorized";
}

export function photoCategoryGroup(category: string): string {
  const c = String(category);
  if (c.startsWith("preop_")) return "Pre-op";
  if (c.startsWith("current_")) return "Current";
  if (c === "day0_donor") return "Day-of Donor";
  if (c === "day0_recipient") return "Day-of Recipient";
  if (c === "intraop") return "Intra-op";
  if (c.startsWith("postop_")) return "Post-op";
  if (c.startsWith("graft_tray") || c.startsWith("img_graft_tray") || c.startsWith("graft_")) return "Graft Handling";
  if (c === "img_graft_inspection" || c === "img_graft_microscopy") return "Graft Handling";
  return "Other";
}

export function scorePhotoForAudit(upload: UploadLike): number {
  const c = inferCanonicalPhotoCategory(upload);
  switch (c) {
    // Graft tray images: highest priority for graft handling analysis
    case "graft_tray_closeup":
    case "img_graft_tray_closeup":
      return 110; // Above day0 to ensure inclusion
    case "graft_tray_overview":
    case "img_graft_tray_overview":
      return 105;
    // Other graft handling images
    case "graft_sorting":
    case "graft_hydration_solution":
    case "graft_count_board":
      return 95;
    case "img_graft_inspection":
    case "img_graft_microscopy":
      return 92;
    case "day0_donor":
    case "day0_recipient":
      return 100;
    case "preop_donor_rear":
    case "preop_front":
    case "preop_top":
    case "preop_crown":
      return 90;
    case "preop_left":
    case "preop_right":
      return 80;
    case "intraop":
      return 70;
    case "postop_healed":
    case "postop_healed_donor":
      return 65;
    case "postop_month3_front":
    case "postop_month3_top":
    case "postop_month3_crown":
    case "postop_month3_donor":
    case "postop_month6_front":
    case "postop_month6_top":
    case "postop_month6_crown":
    case "postop_month6_donor":
    case "postop_month9_front":
    case "postop_month9_top":
    case "postop_month9_crown":
    case "postop_month9_donor":
    case "postop_month12_front":
    case "postop_month12_top":
    case "postop_month12_crown":
    case "postop_month12_donor":
    case "postop_week1_recipient":
    case "postop_week1_donor":
    case "postop_day1_recipient":
    case "postop_day1_donor":
    case "postop_day0":
      return 72;
    case "current_front":
    case "current_top":
    case "current_donor_rear":
    case "current_left":
    case "current_right":
    case "current_crown":
      return 60;
    case "preop_misc":
      return 55;
    default:
      return 30;
  }
}

export type AuditImageSelectionLog = {
  totalUploads: number;
  maxSelected: number;
  graftTrayAvailable: number;
  graftTraySelected: number;
  graftTrayCategoriesFound: string[];
  fallbackUsed: boolean;
  warning?: string;
};

/**
 * Select images for AI audit with explicit graft tray prioritization.
 * Priority order:
 * 1. graft_tray_closeup (highest)
 * 2. graft_tray_overview / img_graft_tray_closeup
 * 3. img_graft_tray_overview
 * 4. Other high-value surgical/day0 images
 * 5. Fallback: remaining images by score
 */
export function buildAuditImageSelection<T extends UploadLike>(
  uploads: T[],
  max = 10,
  options?: { enableDebugLog?: boolean; caseId?: string }
): T[] {
  const { enableDebugLog, caseId } = options ?? {};

  if (uploads.length <= max) {
    if (enableDebugLog) {
      // eslint-disable-next-line no-console
      console.log(`[buildAuditImageSelection${caseId ? ` ${caseId}` : ""}] All ${uploads.length} uploads selected (under max ${max})`);
    }
    return uploads;
  }

  const byCategory = new Map<string, T[]>();
  const graftTrayCategories = new Set<string>();

  for (const upload of uploads) {
    const cat = inferCanonicalPhotoCategory(upload);
    const arr = byCategory.get(cat) ?? [];
    arr.push(upload);
    byCategory.set(cat, arr);

    // Track graft tray categories found
    if (
      cat.startsWith("graft_tray") ||
      cat.startsWith("img_graft_tray") ||
      cat === "graft_sorting" ||
      cat === "graft_hydration_solution" ||
      cat === "graft_count_board"
    ) {
      graftTrayCategories.add(cat);
    }
  }

  const picks: T[] = [];

  // PRIORITY 1: Graft tray categories (highest priority for graft handling analysis)
  const graftTrayPriority = [
    "graft_tray_closeup", // Patient closeup (highest)
    "img_graft_tray_closeup", // Doctor/clinic closeup
    "graft_tray_overview", // Patient overview
    "img_graft_tray_overview", // Doctor/clinic overview
    "graft_sorting",
    "graft_hydration_solution",
    "graft_count_board",
  ];

  for (const cat of graftTrayPriority) {
    const uploadsForCat = byCategory.get(cat);
    if (uploadsForCat && uploadsForCat.length > 0) {
      // Take up to 2 images per graft tray category (if multiple exist)
      const toAdd = uploadsForCat.slice(0, 2);
      for (const upload of toAdd) {
        if (picks.length < max && !picks.includes(upload)) {
          picks.push(upload);
        }
      }
    }
    if (picks.length >= max) break;
  }

  const graftTraySelected = picks.length;
  const fallbackUsed = picks.length === 0;

  // PRIORITY 2: Standard surgical categories
  if (picks.length < max) {
    const categoryPriority = [
      "day0_donor",
      "day0_recipient",
      "preop_donor_rear",
      "preop_front",
      "preop_top",
      "preop_crown",
      "preop_left",
      "preop_right",
      "intraop",
      "postop_healed",
      "postop_month12_front",
      "postop_month12_top",
      "postop_month12_crown",
      "postop_month6_front",
      "postop_month6_top",
      "postop_month6_crown",
      "postop_month3_front",
      "postop_month3_top",
      "postop_month3_crown",
      "postop_week1_recipient",
      "postop_day0",
    ];

    for (const cat of categoryPriority) {
      const first = byCategory.get(cat)?.[0];
      if (first && !picks.includes(first)) {
        picks.push(first);
      }
      if (picks.length >= max) break;
    }
  }

  // PRIORITY 3: Fallback - remaining images by score
  if (picks.length < max) {
    const remaining = [...uploads]
      .filter((u) => !picks.includes(u))
      .sort((a, b) => scorePhotoForAudit(b) - scorePhotoForAudit(a));
    for (const upload of remaining) {
      picks.push(upload);
      if (picks.length >= max) break;
    }
  }

  // Debug logging (non-production visible - console only)
  if (enableDebugLog) {
    const logData: AuditImageSelectionLog = {
      totalUploads: uploads.length,
      maxSelected: max,
      graftTrayAvailable: Array.from(graftTrayCategories).reduce(
        (sum, cat) => sum + (byCategory.get(cat)?.length ?? 0),
        0
      ),
      graftTraySelected,
      graftTrayCategoriesFound: Array.from(graftTrayCategories),
      fallbackUsed,
    };

    // Guard: warn if graft tray images exist but none were selected
    if (logData.graftTrayAvailable > 0 && graftTraySelected === 0) {
      logData.warning = `CRITICAL: ${logData.graftTrayAvailable} graft tray images exist but NONE selected`;
    }

    // eslint-disable-next-line no-console
    console.warn(`[buildAuditImageSelection${caseId ? ` ${caseId}` : ""}]`, logData);
  }

  return picks;
}

/**
 * Guard function: throws warning if graft tray images exist but weren't selected.
 * Use this for defensive programming in critical paths.
 */
export function guardGraftTraySelection<T extends UploadLike>(
  allUploads: T[],
  selectedUploads: T[],
  context?: string
): void {
  const graftTrayCats = new Set([
    "graft_tray_closeup",
    "graft_tray_overview",
    "img_graft_tray_closeup",
    "img_graft_tray_overview",
    "graft_sorting",
    "graft_hydration_solution",
    "graft_count_board",
  ]);

  const availableGraftTray = allUploads.filter((u) => graftTrayCats.has(inferCanonicalPhotoCategory(u)));
  const selectedGraftTray = selectedUploads.filter((u) => graftTrayCats.has(inferCanonicalPhotoCategory(u)));

  if (availableGraftTray.length > 0 && selectedGraftTray.length === 0) {
    const msg = `[guardGraftTraySelection${context ? ` ${context}` : ""}] WARNING: ${availableGraftTray.length} graft tray images available but 0 selected`;
    // eslint-disable-next-line no-console
    console.warn(msg);
    // In development, could also throw:
    // throw new Error(msg);
  }
}
