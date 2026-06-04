// GET /api/surgery-upload/cases/[caseId]/photo-export — Stage 8A surgery_photo ZIP export.
// Node runtime: ZIP + Supabase storage download. Patients are denied; case access required.

import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolvePhotoPackExportRole } from "@/lib/surgeryUpload/photoExportAccess";
import {
  SURGERY_PHOTO_SLOTS,
  isValidSurgerySlot,
  normalizeSurgerySlot,
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
  pickPatientFacingLabel,
  shortCaseId,
  type SurgeryUploadRowForExport,
} from "@/lib/surgeryUpload/photoExportPack";

export const runtime = "nodejs";

const MAX_EXPORT_PHOTOS = 300;
const MAX_EXPORT_SOURCE_BYTES = 500 * 1024 * 1024;
/** When more than half of files are missing after download attempts, fail the export. */
const MISSING_RATIO_ABORT = 0.5;

const PROCEDURE_LABELS: Record<string, string> = Object.fromEntries(
  SURGERY_PROCEDURE_TYPES.map((p) => [p.value, p.label])
);

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
  const { caseId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const slotParam = searchParams.get("slot");

  let slotFilter: SurgeryPhotoSlotKey | null = null;
  if (slotParam) {
    if (!isValidSurgerySlot(slotParam)) {
      return NextResponse.json({ error: "Invalid photo slot." }, { status: 400 });
    }
    slotFilter = normalizeSurgerySlot(slotParam);
  }

  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const exportRole = await resolvePhotoPackExportRole(user);
  if (!exportRole) {
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
  const exportList = filterSurgeryPhotoExports(rows, slotFilter);

  if (exportList.length === 0) {
    return NextResponse.json(
      { error: "No surgery photos are available to export for this case." },
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

  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const shortId = shortCaseId(caseId);
  const patientLabel = pickPatientFacingLabel({
    patientReference: details.patient_reference as string | null,
    caseTitle: (caseRow.title as string | null) ?? null,
  });
  const caseReference =
    (typeof details.patient_reference === "string" && details.patient_reference.trim()) ||
    (typeof caseRow.title === "string" && caseRow.title.trim()) ||
    shortId;
  const surgeryDate =
    typeof details.surgery_date === "string" ? details.surgery_date : null;
  const zipDisplayName = buildZipDisplayName({
    patientLabel,
    caseReference,
    surgeryDate,
    shortCase: shortId,
  });
  const attachmentFilename = buildZipAttachmentFilename({
    caseReference,
    surgeryDate,
    shortCase: shortId,
  });
  const rootFolder = buildZipRootFolderName({
    patientLabel,
    caseReference,
    shortCase: shortId,
  });

  const zip = new JSZip();
  const root = zip.folder(rootFolder);
  if (!root) {
    return NextResponse.json({ error: "Could not build export archive." }, { status: 500 });
  }

  const slotLabelByKey = Object.fromEntries(SURGERY_PHOTO_SLOTS.map((s) => [s.key, s.label]));

  const manifestEntries: Record<string, unknown>[] = [];
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
      const entryMissing = buildManifestEntry({
        caseId,
        caseReference,
        clinicName,
        clinicProfileId: typeof details.clinic_profile_id === "string" ? details.clinic_profile_id : null,
        surgeon,
        procedureLabel,
        surgeryDate,
        upload: u,
        slot,
        slotLabel: slotLabelByKey[slot] ?? slot,
        exportedFilename,
        includeFile: false,
        skipReason: dlErr?.message || "missing",
      });
      manifestEntries.push(entryMissing);
      csvRows.push(manifestEntryToCsvRow(entryMissing));
      continue;
    }

    const buf = Buffer.from(await fileBlob.arrayBuffer());
    downloadedBytes += buf.length;
    if (downloadedBytes > MAX_EXPORT_SOURCE_BYTES) {
      await recordFailedExport(admin, {
        caseId,
        actorId: user.id,
        slotFilter,
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

    const entryOk = buildManifestEntry({
      caseId,
      caseReference,
      clinicName,
      clinicProfileId: typeof details.clinic_profile_id === "string" ? details.clinic_profile_id : null,
      surgeon,
      procedureLabel,
      surgeryDate,
      upload: u,
      slot,
      slotLabel: slotLabelByKey[slot] ?? slot,
      exportedFilename,
      includeFile: true,
      skipReason: null,
    });
    manifestEntries.push(entryOk);
    csvRows.push(manifestEntryToCsvRow(entryOk));
  }

  const okCount = exportList.length - skipped.length;
  if (okCount === 0) {
    await recordFailedExport(admin, {
      caseId,
      actorId: user.id,
      slotFilter,
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
      slotFilter,
      zipFilename: attachmentFilename,
      error: "Too many files were missing from storage.",
    });
    return NextResponse.json(
      { error: "Too many surgery photos are missing from storage. Please contact HairAudit support." },
      { status: 500 }
    );
  }

  const manifestJson = {
    generated_at: new Date().toISOString(),
    case_id: caseId,
    case_reference: caseReference,
    patient_label: patientLabel || null,
    clinic_name: clinicName || null,
    surgeon: surgeon || null,
    procedure_type: procedureType || null,
    surgery_date: surgeryDate,
    export_scope: slotFilter ? "slot" : "all",
    slot_key: slotFilter,
    photo_count_exported: okCount,
    photo_count_requested: exportList.length,
    skipped_files: skipped,
    entries: manifestEntries,
    internal: {
      zip_filename: zipDisplayName,
      downloaded_source_bytes: downloadedBytes,
    },
  };

  const csvHeader: string[] = [
    "case_id",
    "case_reference",
    "clinic_name",
    "surgeon",
    "procedure_type",
    "surgery_date",
    "upload_id",
    "slot_key",
    "slot_label",
    "original_filename",
    "exported_filename",
    "uploaded_at",
    "uploaded_by",
    "added_after_review_request",
    "quality_warning",
    "width",
    "height",
    "original_size_bytes",
    "compressed_size_bytes",
    "file_included",
    "skip_reason",
  ];

  const csvBody = [
    csvHeader.join(","),
    ...csvRows.map((row) => csvHeader.map((h) => csvEscape(String(row[h] ?? ""))).join(",")),
  ].join("\r\n");

  root.file("manifest.json", JSON.stringify(manifestJson, null, 2));
  root.file("manifest.csv", csvBody);

  let zipBuffer: Buffer;
  try {
    zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
  } catch (e) {
    console.error("[photo-export] zip generate", e);
    await recordFailedExport(admin, {
      caseId,
      actorId: user.id,
      slotFilter,
      zipFilename: attachmentFilename,
      error: "ZIP generation failed.",
    });
    return NextResponse.json({ error: "Could not build export archive." }, { status: 500 });
  }

  /** Stage 8A: in-memory ZIP; practical limit enforced by MAX_EXPORT_SOURCE_BYTES + photo count. */
  if (zipBuffer.length > MAX_EXPORT_SOURCE_BYTES * 2) {
    await recordFailedExport(admin, {
      caseId,
      actorId: user.id,
      slotFilter,
      zipFilename: attachmentFilename,
      error: "ZIP output exceeded safety limit.",
    });
    return NextResponse.json(
      {
        error:
          "This export is too large. Please export by category or contact HairAudit support.",
      },
      { status: 413 }
    );
  }

  try {
    await admin.from("surgery_upload_photo_exports").insert({
      case_id: caseId,
      actor_id: user.id,
      export_scope: slotFilter ? "slot" : "all",
      slot_key: slotFilter,
      photo_count: okCount,
      zip_filename: zipDisplayName,
      status: "completed",
      metadata: {
        requested_count: exportList.length,
        skipped_count: skipped.length,
        downloaded_source_bytes: downloadedBytes,
        zip_bytes: zipBuffer.length,
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
      photoCount: okCount,
      scope: slotFilter ? "slot" : "all",
      slotKey: slotFilter,
      skippedCount: skipped.length,
    },
  });

  const asciiName = attachmentFilename.replace(/[^\x20-\x7E]/g, "_");
  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${asciiName}"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildManifestEntry(args: {
  caseId: string;
  caseReference: string;
  clinicName: string;
  clinicProfileId: string | null;
  surgeon: string;
  procedureLabel: string;
  surgeryDate: string | null;
  upload: SurgeryUploadRowForExport;
  slot: SurgeryPhotoSlotKey;
  slotLabel: string;
  exportedFilename: string;
  includeFile: boolean;
  skipReason: string | null;
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
    case_id: args.caseId,
    case_reference: args.caseReference,
    clinic_name: args.clinicName,
    surgeon: args.surgeon,
    procedure_type: args.procedureLabel,
    surgery_date: args.surgeryDate ?? "",
    upload_id: args.upload.id,
    slot_key: args.slot,
    slot_label: args.slotLabel,
    original_filename: originalName,
    exported_filename: args.exportedFilename,
    uploaded_at: args.upload.created_at,
    uploaded_by: args.upload.user_id ?? "",
    added_after_review_request: addedAfter,
    quality_warning: quality,
    width,
    height,
    original_size_bytes: origBytes,
    compressed_size_bytes: compBytes,
    file_included: args.includeFile,
    skip_reason: args.skipReason ?? "",
    internal: {
      clinic_profile_id: args.clinicProfileId,
      storage_path: args.upload.storage_path,
    },
  };
}

function manifestEntryToCsvRow(entry: Record<string, unknown>): Record<string, string> {
  return {
    case_id: String(entry.case_id ?? ""),
    case_reference: String(entry.case_reference ?? ""),
    clinic_name: String(entry.clinic_name ?? ""),
    surgeon: String(entry.surgeon ?? ""),
    procedure_type: String(entry.procedure_type ?? ""),
    surgery_date: String(entry.surgery_date ?? ""),
    upload_id: String(entry.upload_id ?? ""),
    slot_key: String(entry.slot_key ?? ""),
    slot_label: String(entry.slot_label ?? ""),
    original_filename: String(entry.original_filename ?? ""),
    exported_filename: String(entry.exported_filename ?? ""),
    uploaded_at: String(entry.uploaded_at ?? ""),
    uploaded_by: String(entry.uploaded_by ?? ""),
    added_after_review_request: entry.added_after_review_request === true ? "true" : "false",
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
    file_included: entry.file_included === true ? "true" : "false",
    skip_reason: String(entry.skip_reason ?? ""),
  };
}

async function recordFailedExport(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  args: {
    caseId: string;
    actorId: string;
    slotFilter: SurgeryPhotoSlotKey | null;
    zipFilename: string;
    error: string;
  }
): Promise<void> {
  try {
    await admin.from("surgery_upload_photo_exports").insert({
      case_id: args.caseId,
      actor_id: args.actorId,
      export_scope: args.slotFilter ? "slot" : "all",
      slot_key: args.slotFilter,
      photo_count: 0,
      zip_filename: args.zipFilename,
      status: "failed",
      error_message: args.error.slice(0, 2000),
      metadata: {},
    });
  } catch {
    /* best-effort */
  }
  await logEvidenceEvent(admin, {
    caseId: args.caseId,
    actorId: args.actorId,
    eventType: "photo_export_failed",
    metadata: {
      scope: args.slotFilter ? "slot" : "all",
      slotKey: args.slotFilter,
      message: args.error.slice(0, 500),
    },
  });
}
