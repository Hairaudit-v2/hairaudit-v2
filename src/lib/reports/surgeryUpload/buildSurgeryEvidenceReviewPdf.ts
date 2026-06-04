/**
 * Stage 7B — Non-AI PDF builder for the Surgery Upload Evidence Review Report.
 * Does not call OpenAI, does not use forensic reportBuilder / Playwright audit PDFs.
 */
import PDFDocument from "pdfkit";
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";
import type { SurgerySlotReviewRow } from "@/lib/surgeryUpload/evidenceReview";
import { getSurgeryRequirementFailures, slotFromSurgeryType } from "@/lib/surgeryUpload/checklist";
import { SURGERY_PROCEDURE_TYPES } from "@/lib/surgeryUpload/fields";
import {
  evidenceReviewStatusLabel,
  slotReviewStatusLabel,
} from "@/lib/surgeryUpload/evidenceReview";
import type { SupabaseClient } from "@supabase/supabase-js";

const PROCEDURE_LABELS = Object.fromEntries(SURGERY_PROCEDURE_TYPES.map((p) => [p.value, p.label]));

function yesNo(v: boolean | null | undefined): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export type SurgeryEvidenceReviewPdfBuildArgs = {
  caseId: string;
  generatedAtIso: string;
  requestedByDisplay: string;
  details: SurgeryUploadDetails;
  uploads: ReadonlyArray<{ type: string; storage_path: string; metadata?: unknown; created_at: string }>;
  slotReviews: ReadonlyArray<SurgerySlotReviewRow>;
};

type Doc = InstanceType<typeof PDFDocument>;

function heading(doc: Doc, title: string) {
  doc.moveDown(0.6);
  doc.fontSize(13).fillColor("#0f172a").text(title, { underline: true });
  doc.moveDown(0.35);
  doc.fontSize(10).fillColor("#334155");
}

function bodyLine(doc: Doc, label: string, value: string) {
  doc.fontSize(10).fillColor("#475569").text(`${label}: `, { continued: true, lineGap: 2 });
  doc.fillColor("#0f172a").text(value || "—", { lineGap: 2 });
}

async function downloadThumbnails(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  for (const p of paths) {
    try {
      const { data: blob, error } = await supabase.storage.from(bucket).download(p);
      if (error || !blob) continue;
      out.set(p, Buffer.from(await blob.arrayBuffer()));
    } catch {
      /* skip */
    }
  }
  return out;
}

/**
 * Build PDF buffer. Embeds thumbnails for surgery_photo uploads when download succeeds.
 */
export async function buildSurgeryEvidenceReviewPdfBuffer(
  supabase: SupabaseClient,
  bucket: string,
  args: SurgeryEvidenceReviewPdfBuildArgs
): Promise<Buffer> {
  const { caseId, generatedAtIso, requestedByDisplay, details, uploads, slotReviews } = args;

  const surgeryUploads = uploads.filter((u) => slotFromSurgeryType(u.type) !== null);
  const failures = getSurgeryRequirementFailures([...uploads], details.photo_checklist_config);

  const thumbPaths = [...new Set(surgeryUploads.map((u) => u.storage_path).filter(Boolean))];
  const thumbs = await downloadThumbnails(supabase, bucket, thumbPaths);

  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(18).fillColor("#0c4a6e").text("Surgery Upload — Evidence Review Report", { align: "center" });
  doc.moveDown(0.25);
  doc.fontSize(9).fillColor("#64748b").text("Non-AI administrative summary of uploaded evidence and structured fields.", {
    align: "center",
  });
  doc.moveDown(1);

  heading(doc, "1. Case overview");
  bodyLine(doc, "Case ID", caseId);
  bodyLine(doc, "Report generated (UTC)", generatedAtIso);
  bodyLine(doc, "Report requested by", requestedByDisplay);
  bodyLine(doc, "Surgery portal status", details.status === "submitted" ? "Submitted for review" : details.status);

  heading(doc, "2. Patient / client reference");
  bodyLine(doc, "Reference", details.patient_reference ?? "—");

  heading(doc, "3. Clinic / doctor (as entered)");
  bodyLine(doc, "Clinic", details.clinic_name ?? "—");
  bodyLine(doc, "Surgeon", details.surgeon_name ?? "—");
  if (details.clinic_profile_id) {
    bodyLine(doc, "Clinic profile ID", details.clinic_profile_id);
  }

  heading(doc, "4. Procedure date and location");
  bodyLine(doc, "Procedure type", details.procedure_type ? PROCEDURE_LABELS[details.procedure_type] ?? details.procedure_type : "—");
  bodyLine(doc, "Surgery date", details.surgery_date ?? "—");

  heading(doc, "5. Submitted surgery details");
  bodyLine(doc, "Extraction machine", details.extraction_machine ?? "—");
  bodyLine(doc, "Punch size", details.punch_size ?? "—");
  bodyLine(doc, "Punch type", details.punch_type ?? "—");
  bodyLine(doc, "Implantation method", details.implantation_method ?? "—");
  bodyLine(doc, "PRP used", yesNo(details.prp_used));
  bodyLine(doc, "Exosomes used", yesNo(details.exosomes_used));
  bodyLine(doc, "Storage solution", details.storage_solution ?? "—");
  bodyLine(doc, "Planned grafts", details.planned_grafts != null ? String(details.planned_grafts) : "—");
  bodyLine(doc, "Actual grafts", details.actual_grafts != null ? String(details.actual_grafts) : "—");
  bodyLine(doc, "Extraction start", details.extraction_start_time ?? "—");
  bodyLine(doc, "Implantation start", details.implantation_start_time ?? "—");
  bodyLine(doc, "Surgery finish", details.surgery_finish_time ?? "—");
  if (details.notes) {
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#475569").text("Clinic notes:", { lineGap: 2 });
    doc.fillColor("#0f172a").text(clip(String(details.notes), 4000), { lineGap: 3 });
  }
  if (details.complication_notes) {
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#475569").text("Complication notes:", { lineGap: 2 });
    doc.fillColor("#0f172a").text(clip(String(details.complication_notes), 2000), { lineGap: 3 });
  }

  heading(doc, "6. Evidence / images received");
  if (surgeryUploads.length === 0) {
    doc.text("No surgery_photo uploads recorded for this case.", { lineGap: 4 });
  } else {
    doc.text(`Total surgery evidence files: ${surgeryUploads.length}`, { lineGap: 4 });
    const bySlot: Record<string, typeof surgeryUploads> = {};
    for (const u of surgeryUploads) {
      const sk = slotFromSurgeryType(u.type);
      if (!sk) continue;
      (bySlot[sk] ||= []).push(u);
    }
    for (const [slotKey, list] of Object.entries(bySlot)) {
      doc.moveDown(0.25);
      doc.fontSize(10.5).fillColor("#0f172a").text(`Slot: ${slotKey}`, { lineGap: 2 });
      let idx = 0;
      for (const u of list) {
        idx += 1;
        const meta = (u.metadata && typeof u.metadata === "object" ? u.metadata : {}) as Record<string, unknown>;
        const low =
          Boolean(meta.low_resolution) || Boolean(meta.quality_warning) || meta.resolution_flag === "low";
        doc.fontSize(9).fillColor("#64748b").text(
          `  ${idx}. ${u.type} — ${u.storage_path} (${u.created_at})${low ? " [quality flag]" : ""}`,
          { lineGap: 2 }
        );
        const buf = thumbs.get(u.storage_path);
        if (buf) {
          if (doc.y > doc.page.height - 160) doc.addPage();
          doc.image(buf, 52, doc.y, { fit: [220, 140] });
          doc.moveDown(8);
        }
      }
    }
  }

  heading(doc, "7. Missing or incomplete required evidence");
  if (failures.length === 0) {
    doc.text("All required checklist slots satisfied at generation time.", { lineGap: 4 });
  } else {
    for (const f of failures) {
      doc.fontSize(10).fillColor("#b45309").text(`• ${f.message}`, { lineGap: 3 });
    }
  }

  heading(doc, "8. Reviewer / admin notes (overall evidence review)");
  bodyLine(doc, "Evidence review status", evidenceReviewStatusLabel(details.evidence_review_status));
  if (details.evidence_review_notes) {
    doc.moveDown(0.2);
    doc.fontSize(10).text(clip(details.evidence_review_notes, 3500), { lineGap: 3 });
  } else {
    doc.text("—", { lineGap: 2 });
  }
  if (details.evidence_request_message) {
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#475569").text("Evidence request message:", { lineGap: 2 });
    doc.fillColor("#0f172a").text(clip(details.evidence_request_message, 2000), { lineGap: 3 });
  }

  heading(doc, "9. Per-slot reviewer decisions");
  if (slotReviews.length === 0) {
    doc.text("No per-slot reviewer rows recorded.", { lineGap: 3 });
  } else {
    for (const r of slotReviews) {
      doc.fontSize(10).text(
        `• ${r.slot_key}: ${slotReviewStatusLabel(r.status)}` +
          (r.reviewer_notes ? ` — ${clip(r.reviewer_notes, 400)}` : ""),
        { lineGap: 3 }
      );
    }
  }

  heading(doc, "10. Non-AI evidence review disclaimer");
  doc.fontSize(9).fillColor("#334155").text(
    "This document is an internal evidence and metadata summary for administrative review. " +
      "It is not a full HairAudit forensic AI surgical audit, does not produce clinical scores, " +
      "and must not be presented as autonomous medical advice.",
    { lineGap: 4, align: "left" }
  );

  doc.addPage();
  doc.fontSize(10).fillColor("#64748b").text("End of report.", { align: "center" });

  doc.end();
  return done;
}
