// GET /api/surgery-upload/cases/[caseId]/photo-export — Stage 8A/8B/8C surgery_photo ZIP export.
// Node runtime: ZIP + Supabase storage download. Patients are denied; case access required.
//
// Query: no params = all photos | slot=<key> = one category | slots=a,b,c = multi (do not combine slot+slots).
//
// Stage 8C — ZIP delivery: JSZip `generateNodeStream({ streamFiles: true })` streams the *compressed*
// archive to the client, avoiding a second full-memory copy of the finished ZIP buffer. Photo
// payloads are still held in memory while the ZIP is built (Supabase `.download()` returns blobs;
// JSZip buffers inputs). A hard cap on downloaded source bytes + photo count remains the primary
// unbounded-growth guard; the legacy post-build `zipBuffer.length` check is skipped when streaming
// because the final size is not known before the response completes.

import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import JSZip from "jszip";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolvePhotoPackExportRole } from "@/lib/surgeryUpload/photoExportAccess";
import {
  SURGERY_PHOTO_SLOTS,
  slotFromSurgeryType,
  type SurgeryPhotoSlotKey,
} from "@/lib/surgeryUpload/checklist";
import { SURGERY_PROCEDURE_TYPES } from "@/lib/surgeryUpload/fields";
import { logEvidenceEvent } from "@/lib/surgeryUpload/logEvidenceEvent";
import {
  SURGERY_EXPORT_SLOT_DIRECTORIES,
  buildExportedImageBasename,
  buildZipAttachmentFilename,
  buildZipDisplayName,
  buildZipRootFolderName,
  estimateUploadBytes,
  filterSurgeryPhotoExports,
  inferExtension,
  parsePhotoExportSlotParams,
  resolveCaseReferenceForExport,
  sanitizePatientDisplayName,
  shortCaseId,
  type SurgeryUploadRowForExport,
} from "@/lib/surgeryUpload/photoExportPack";
import {
  EXPORT_MANIFEST_VERSION,
  EXPORT_SOURCE,
  EXPORT_MANIFEST_SCHEMA_VERSION,
  CRM_CSV_COLUMNS,
} from "@/lib/surgeryUpload/photoExportManifest";
import { batchStaffDisplayLabels } from "@/lib/surgeryUpload/photoExportStaffLabels";

export const runtime = "nodejs";

const MAX_EXPORT_PHOTOS = 300;
const MAX_EXPORT_SOURCE_BYTES = 500 * 1024 * 1024;
const MISSING_RATIO_ABORT = 0.5;

const PROCEDURE_LABELS: Record<string, string> = Object.fromEntries(
  SURGERY_PROCEDURE_TYPES.map((p) => [p.value, p.label])
);

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function deriveExportScope(slots: Set<SurgeryPhotoSlotKey> | null): {
  exportScope: "all" | "category" | "multi_category";
  slotKeyForDb: string | null;
  slotKeysOrdered: string[];
} {
  if (!slots || slots.size === 0) {
    return { exportScope: "all", slotKeyForDb: null, slotKeysOrdered: [] };
  }
  const arr = SURGERY_PHOTO_SLOTS.map((s) => s.key).filter((k) => slots.has(k));
  if (arr.length === 1) return { exportScope: "category", slotKeyForDb: arr[0]!, slotKeysOrdered: arr };
  return { exportScope: "multi_category", slotKeyForDb: null, slotKeysOrdered: arr };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
  const { caseId } = await ctx.params;
  const url = new URL(req.url);
  const parsedSlots = parsePhotoExportSlotParams(url.searchParams);
  if (!parsedSlots.ok) {
    return NextResponse.json({ error: parsedSlots.error }, { status: 400 });
  }
  const slotsFilter = parsedSlots.slots;

  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await resolvePhotoPackExportRole(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();

  const { data: caseRow, error: caseErr } = await admin
    .from("cases")
    .select("id, title, user_id, patient_id, doctor_id, clinic_id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr) {
    console.error("[photo-export] case load", caseErr.message);
    return NextResponse.json({ error: "Could not load case" }, { status: 500 });
  }
  if (!caseRow || !(await canAccessCase(user.id, caseRow))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: details, error: detErr } = await admin
    .from("surgery_upload_details")
    .select(
      "patient_reference, clinic_name, clinic_profile_id, surgeon_name, surgery_date, procedure_type"
    )
    .eq("case_id", caseId)
    .maybeSingle();

  if (detErr) {
    console.error("[photo-export] surgery details", detErr.message);
    return NextResponse.json({ error: "Could not load surgery upload" }, { status: 500 });
  }
  if (!details) {
    return NextResponse.json({ error: "Surgery upload not found for this case." }, { status: 404 });
  }

  const { data: uploadRows, error: upErr } = await admin
    .from("uploads")
    .select("id, type, storage_path, user_id, metadata, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (upErr) {
    console.error("[photo-export] uploads", upErr.message);
    return NextResponse.json({ error: "Could not load uploads" }, { status: 500 });
  }

  const rows = (uploadRows ?? []) as SurgeryUploadRowForExport[];
  const exportList = filterSurgeryPhotoExports(rows, slotsFilter);

  if (exportList.length === 0) {
    return NextResponse.json(
      {
        error:
          slotsFilter && slotsFilter.size > 0
            ? "No surgery photos in the selected categories."
            : "No surgery photos are available to export for this case.",
      },
      { status: 404 }
    );
  }

  if (exportList.length > MAX_EXPORT_PHOTOS) {
    return NextResponse.json(
      {
        error:
          "This export is too large. Please export by category or contact HairAudit support.",
      },
      { status: 413 }
    );
  }

  let estimatedTotal = 0;
  let unknownBytes = 0;
  for (const u of exportList) {
    const meta = (u.metadata && typeof u.metadata === "object" ? u.metadata : null) as Record<
      string,
      unknown
    > | null;
    const b = estimateUploadBytes(meta);
    if (b != null) estimatedTotal += b;
    else unknownBytes += 1;
  }
  const paddedEstimate = estimatedTotal + unknownBytes * 5 * 1024 * 1024;
  if (paddedEstimate > MAX_EXPORT_SOURCE_BYTES) {
    return NextResponse.json(
      {
        error:
          "This export is too large. Please export by category or contact HairAudit support.",
      },
      { status: 413 }
    );
  }

  let patientName = "";
  const pid = caseRow.patient_id as string | null | undefined;
  if (pid) {
    const { data: patProf } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", pid)
      .maybeSingle();
    patientName = sanitizePatientDisplayName((patProf?.display_name as string | null) ?? null);
  }

  const patientReference =
    typeof details.patient_reference === "string" ? details.patient_reference.trim() : "";
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const shortId = shortCaseId(caseId);
  const caseReference = resolveCaseReferenceForExport({
    patientReference: details.patient_reference as string | null,
    caseTitle: (caseRow.title as string | null) ?? null,
    shortCaseId: shortId,
  });
  const surgeryDate =
    typeof details.surgery_date === "string" ? details.surgery_date : null;
  const zipDisplayName = buildZipDisplayName({
    patientName,
    caseReference,
    surgeryDate,
    shortCase: shortId,
  });
  const attachmentFilename = buildZipAttachmentFilename({
    patientName,
    caseReference,
    surgeryDate,
    shortCase: shortId,
  });
  const rootFolder = buildZipRootFolderName({
    patientName,
    caseReference,
    shortCase: shortId,
  });

  const { exportScope, slotKeyForDb, slotKeysOrdered } = deriveExportScope(slotsFilter);

  const zip = new JSZip();
  const root = zip.folder(rootFolder);
  if (!root) {
    return NextResponse.json({ error: "Could not build export archive." }, { status: 500 });
  }

  const slotLabelByKey = Object.fromEntries(SURGERY_PHOTO_SLOTS.map((s) => [s.key, s.label]));

  const uploaderIds = Array.from(
    new Set(exportList.map((u) => u.user_id).filter((id): id is string => typeof id === "string" && id.length > 0))
  );
  const uploaderLabels = await batchStaffDisplayLabels(admin, uploaderIds);

  const manifestPhotoRows: Record<string, unknown>[] = [];
  const csvRows: Record<string, string>[] = [];
  const skipped: Array<{ upload_id: string; reason: string }> = [];
  let downloadedBytes = 0;

  const clinicName = typeof details.clinic_name === "string" ? details.clinic_name : "";
  const surgeon = typeof details.surgeon_name === "string" ? details.surgeon_name : "";
  const procedureType = typeof details.procedure_type === "string" ? details.procedure_type : "";
  const procedureLabel = procedureType ? PROCEDURE_LABELS[procedureType] ?? procedureType : "";

  for (const u of exportList) {
    const slot = slotFromSurgeryType(u.type)!;
    const slotDir = SURGERY_EXPORT_SLOT_DIRECTORIES[slot];
    const uploadedById = u.user_id ?? null;
    const uploadedByLabel = uploadedById ? (uploaderLabels.get(uploadedById) ?? "") : "";
    const meta = (u.metadata && typeof u.metadata === "object" ? u.metadata : null) as Record<
      string,
      unknown
    > | null;
    const mime = typeof meta?.mime === "string" ? meta.mime : null;
    const ext = inferExtension(u.storage_path, mime);
    const exportedFilename = buildExportedImageBasename({
      slot,
      createdAt: u.created_at,
      uploadId: u.id,
      ext,
    });

    const { data: fileBlob, error: dlErr } = await admin.storage.from(bucket).download(u.storage_path);
    if (dlErr || !fileBlob) {
      skipped.push({ upload_id: u.id, reason: dlErr?.message || "missing" });
      const entryMissing = buildManifestPhotoEntry({
        patientName,
        patientReference,
        caseReference,
        clinicName,
        surgeon,
        procedureLabel,
        surgeryDate,
        upload: u,
        slot,
        slotLabel: slotLabelByKey[slot] ?? slot,
        exportedFilename,
        includeFile: false,
        skipReason: dlErr?.message || "missing",
        uploadedById,
        uploadedByLabel,
      });
      manifestPhotoRows.push(entryMissing);
      csvRows.push(manifestPhotoEntryToCsvRow(entryMissing));
      continue;
    }

    const buf = Buffer.from(await fileBlob.arrayBuffer());
    downloadedBytes += buf.length;
    if (downloadedBytes > MAX_EXPORT_SOURCE_BYTES) {
      await recordFailedExport(admin, {
        caseId,
        actorId: user.id,
        exportScope,
        slotKeyForDb,
        slotKeysOrdered,
        zipFilename: attachmentFilename,
        error: "Export exceeded maximum size while building.",
      });
      return NextResponse.json(
        {
          error:
            "This export is too large. Please export by category or contact HairAudit support.",
        },
        { status: 413 }
      );
    }

    const folder = root.folder(slotDir);
    if (folder) {
      folder.file(exportedFilename, buf);
    }

    const entryOk = buildManifestPhotoEntry({
      patientName,
      patientReference,
      caseReference,
      clinicName,
      surgeon,
      procedureLabel,
      surgeryDate,
      upload: u,
      slot,
      slotLabel: slotLabelByKey[slot] ?? slot,
      exportedFilename,
      includeFile: true,
      skipReason: null,
      uploadedById,
      uploadedByLabel,
    });
    manifestPhotoRows.push(entryOk);
    csvRows.push(manifestPhotoEntryToCsvRow(entryOk));
  }

  const okCount = exportList.length - skipped.length;
  if (okCount === 0) {
    await recordFailedExport(admin, {
      caseId,
      actorId: user.id,
      exportScope,
      slotKeyForDb,
      slotKeysOrdered,
      zipFilename: attachmentFilename,
      error: "No photo files could be retrieved from storage.",
    });
    return NextResponse.json(
      { error: "No photo files could be retrieved from storage." },
      { status: 500 }
    );
  }

  if (skipped.length / exportList.length > MISSING_RATIO_ABORT) {
    await recordFailedExport(admin, {
      caseId,
      actorId: user.id,
      exportScope,
      slotKeyForDb,
      slotKeysOrdered,
      zipFilename: attachmentFilename,
      error: "Too many files were missing from storage.",
    });
    return NextResponse.json(
      { error: "Too many surgery photos are missing from storage. Please contact HairAudit support." },
      { status: 500 }
    );
  }

  const manifestJson = {
    manifest_version: EXPORT_MANIFEST_VERSION,
    export_source: EXPORT_SOURCE,
    export: {
      generated_at: new Date().toISOString(),
      export_scope: exportScope,
      selected_slots: slotKeysOrdered,
      photo_count: exportList.length,
      included_file_count: okCount,
      skipped_file_count: skipped.length,
    },
    case: {
      patient_name: patientName || null,
      patient_reference: patientReference || null,
      case_reference: caseReference,
      surgery_date: surgeryDate,
      clinic_name: clinicName || null,
      surgeon: surgeon || null,
      procedure_type: procedureLabel || null,
    },
    photos: manifestPhotoRows,
    internal: {
      case_id: caseId,
      zip_filename: zipDisplayName,
      downloaded_source_bytes: downloadedBytes,
      /** JSON is for technical use; CRM teams should prefer manifest.csv. */
      note: "Per-photo storage_path lives under each photo.internal only.",
    },
  };

  const csvBody = [
    CRM_CSV_COLUMNS.join(","),
    ...csvRows.map((row) =>
      CRM_CSV_COLUMNS.map((h) => csvEscape(String(row[h] ?? ""))).join(",")
    ),
  ].join("\r\n");

  root.file("manifest.json", JSON.stringify(manifestJson, null, 2));
  root.file("manifest.csv", csvBody);

  const patientNameIncluded = patientName.length > 0;
  const patientReferenceIncluded = patientReference.length > 0;
  const streamingUsed = true;

  try {
    await admin.from("surgery_upload_photo_exports").insert({
      case_id: caseId,
      actor_id: user.id,
      export_scope: exportScope,
      slot_key: slotKeyForDb,
      photo_count: okCount,
      zip_filename: zipDisplayName,
      status: "completed",
      metadata: {
        manifest_version: EXPORT_MANIFEST_VERSION,
        export_source: EXPORT_SOURCE,
        manifest_schema_version: EXPORT_MANIFEST_SCHEMA_VERSION,
        export_scope: exportScope,
        slot_keys: slotKeysOrdered,
        patient_name_included: patientNameIncluded,
        patient_reference_included: patientReferenceIncluded,
        case_reference: caseReference,
        zip_filename: zipDisplayName,
        skipped_count: skipped.length,
        included_count: okCount,
        requested_count: exportList.length,
        downloaded_source_bytes: downloadedBytes,
        streaming_used: streamingUsed,
        zip_bytes: null,
      },
    });
  } catch (e) {
    console.warn("[photo-export] export log insert failed", e);
  }

  await logEvidenceEvent(admin, {
    caseId,
    actorId: user.id,
    eventType: "photo_export_created",
    metadata: {
      manifestVersion: EXPORT_MANIFEST_VERSION,
      exportSource: EXPORT_SOURCE,
      manifestSchemaVersion: EXPORT_MANIFEST_SCHEMA_VERSION,
      streamingUsed,
      photoCount: okCount,
      exportScope,
      slotKeys: slotKeysOrdered,
      categoryCount: slotKeysOrdered.length || (exportScope === "all" ? 0 : undefined),
      skippedCount: skipped.length,
    },
  });

  const asciiName = attachmentFilename.replace(/[^\x20-\x7E]/g, "_");

  let nodeZipStream: NodeJS.ReadableStream;
  try {
    nodeZipStream = zip.generateNodeStream({
      type: "nodebuffer",
      streamFiles: true,
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
  } catch (e) {
    console.error("[photo-export] zip stream init", e);
    await recordFailedExport(admin, {
      caseId,
      actorId: user.id,
      exportScope,
      slotKeyForDb,
      slotKeysOrdered,
      zipFilename: attachmentFilename,
      error: "ZIP generation failed.",
    });
    return NextResponse.json({ error: "Could not build export archive." }, { status: 500 });
  }

  const webBody = Readable.toWeb(nodeZipStream as Readable) as unknown as BodyInit;

  return new NextResponse(webBody, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${asciiName}"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildManifestPhotoEntry(args: {
  patientName: string;
  patientReference: string;
  caseReference: string;
  clinicName: string;
  surgeon: string;
  procedureLabel: string;
  surgeryDate: string | null;
  upload: SurgeryUploadRowForExport;
  slot: SurgeryPhotoSlotKey;
  slotLabel: string;
  exportedFilename: string;
  includeFile: boolean;
  skipReason: string | null;
  uploadedById: string | null;
  uploadedByLabel: string;
}): Record<string, unknown> {
  const m = args.upload.metadata;
  const originalName =
    (m && typeof m.original_filename === "string" && m.original_filename) ||
    (m && typeof m.original_name === "string" && m.original_name) ||
    "";
  const width = m && typeof m.width === "number" ? m.width : "";
  const height = m && typeof m.height === "number" ? m.height : "";
  const origBytes = m && typeof m.original_size_bytes === "number" ? m.original_size_bytes : "";
  const compBytes = m && typeof m.compressed_size_bytes === "number" ? m.compressed_size_bytes : "";
  const quality =
    m && typeof m.quality_warning === "string" ? String(m.quality_warning).slice(0, 500) : "";
  const addedAfter = m && m.added_after_review_request === true;

  return {
    patient_name: args.patientName,
    patient_reference: args.patientReference,
    case_reference: args.caseReference,
    surgery_date: args.surgeryDate ?? "",
    clinic_name: args.clinicName,
    surgeon: args.surgeon,
    procedure_type: args.procedureLabel,
    photo_category: args.slotLabel,
    photo_category_key: args.slot,
    original_filename: originalName,
    exported_filename: args.exportedFilename,
    uploaded_at: args.upload.created_at,
    uploaded_by_label: args.uploadedByLabel,
    added_after_review_request: addedAfter,
    quality_warning: quality,
    width,
    height,
    original_size_bytes: origBytes,
    compressed_size_bytes: compBytes,
    file_included: args.includeFile,
    skip_reason: args.skipReason ?? "",
    internal: {
      upload_id: args.upload.id,
      storage_path: args.upload.storage_path,
      uploaded_by_id: args.uploadedById,
    },
  };
}

function manifestPhotoEntryToCsvRow(entry: Record<string, unknown>): Record<string, string> {
  const boolStr = (v: unknown) => (v === true ? "true" : "false");
  const uploadedBy = String(entry.uploaded_by_label ?? "");
  return {
    manifest_version: String(EXPORT_MANIFEST_VERSION),
    export_source: EXPORT_SOURCE,
    patient_name: String(entry.patient_name ?? ""),
    patient_reference: String(entry.patient_reference ?? ""),
    case_reference: String(entry.case_reference ?? ""),
    surgery_date: String(entry.surgery_date ?? ""),
    clinic_name: String(entry.clinic_name ?? ""),
    surgeon: String(entry.surgeon ?? ""),
    procedure_type: String(entry.procedure_type ?? ""),
    photo_category: String(entry.photo_category ?? ""),
    photo_category_key: String(entry.photo_category_key ?? ""),
    original_filename: String(entry.original_filename ?? ""),
    exported_filename: String(entry.exported_filename ?? ""),
    uploaded_at: String(entry.uploaded_at ?? ""),
    uploaded_by: uploadedBy,
    added_after_review_request: boolStr(entry.added_after_review_request),
    quality_warning: String(entry.quality_warning ?? ""),
    width: entry.width === "" || entry.width == null ? "" : String(entry.width),
    height: entry.height === "" || entry.height == null ? "" : String(entry.height),
    original_size_bytes:
      entry.original_size_bytes === "" || entry.original_size_bytes == null
        ? ""
        : String(entry.original_size_bytes),
    compressed_size_bytes:
      entry.compressed_size_bytes === "" || entry.compressed_size_bytes == null
        ? ""
        : String(entry.compressed_size_bytes),
    file_included: boolStr(entry.file_included),
    skip_reason: String(entry.skip_reason ?? ""),
  };
}

async function recordFailedExport(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  args: {
    caseId: string;
    actorId: string;
    exportScope: string;
    slotKeyForDb: string | null;
    slotKeysOrdered: string[];
    zipFilename: string;
    error: string;
  }
): Promise<void> {
  try {
    await admin.from("surgery_upload_photo_exports").insert({
      case_id: args.caseId,
      actor_id: args.actorId,
      export_scope: args.exportScope,
      slot_key: args.slotKeyForDb,
      photo_count: 0,
      zip_filename: args.zipFilename,
      status: "failed",
      error_message: args.error.slice(0, 2000),
      metadata: {
        slot_keys: args.slotKeysOrdered,
        export_scope: args.exportScope,
        manifest_version: EXPORT_MANIFEST_VERSION,
        export_source: EXPORT_SOURCE,
        manifest_schema_version: EXPORT_MANIFEST_SCHEMA_VERSION,
      },
    });
  } catch {
    /* best-effort */
  }
  await logEvidenceEvent(admin, {
    caseId: args.caseId,
    actorId: args.actorId,
    eventType: "photo_export_failed",
    metadata: {
      exportScope: args.exportScope,
      slotKeys: args.slotKeysOrdered,
      message: args.error.slice(0, 500),
    },
  });
}
