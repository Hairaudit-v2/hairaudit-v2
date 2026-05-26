"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BULK_IMAGE_CATEGORIES } from "@/lib/hair-audit/bulkUpload/constants";
import { computeCaseReadiness } from "@/lib/hair-audit/bulkUpload/validation";
import type {
  BulkBatchDetailsInput,
  BulkCaseDraftInput,
  BulkCaseImageRow,
  BulkCaseRow,
  HairAuditCaseBatchRow,
} from "@/lib/hair-audit/bulkUpload/types";
import { UploadQueue, UPLOAD_LIMITS } from "@/lib/uploads/safeUpload";
import BulkImageThumb from "./BulkImageThumb";
import BulkBatchProfessionalsPickers, {
  type BulkProfileClinicOption,
  type BulkProfileDoctorOption,
} from "./BulkBatchProfessionalsPickers";

type WizardProps = {
  batch: HairAuditCaseBatchRow;
  initialCases: BulkCaseRow[];
  initialImages: BulkCaseImageRow[];
};

const STEPS = ["Batch details", "Cases", "Images", "Review"] as const;

function emptyCase(index: number): BulkCaseDraftInput {
  return {
    clientKey: crypto.randomUUID(),
    case_label: `Case ${index + 1}`,
    patient_reference: "",
    patient_email: "",
    graft_count: null,
    hair_count: null,
    case_specific_notes: "",
  };
}

function batchToInput(batch: HairAuditCaseBatchRow): BulkBatchDetailsInput {
  return {
    batch_name: batch.batch_name,
    doctor_id: batch.doctor_id,
    clinic_id: batch.clinic_id,
    shared_surgery_date: batch.shared_surgery_date,
    shared_location: batch.shared_location ?? "",
    shared_punch_type: batch.shared_punch_type ?? "",
    shared_punch_size: batch.shared_punch_size ?? "",
    shared_extraction_method: batch.shared_extraction_method ?? "",
    shared_implantation_method: batch.shared_implantation_method ?? "",
    shared_equipment_notes: batch.shared_equipment_notes ?? "",
    shared_preservation_notes: batch.shared_preservation_notes ?? "",
    shared_general_notes: batch.shared_general_notes ?? "",
  };
}

function casesToDraft(rows: BulkCaseRow[]): BulkCaseDraftInput[] {
  if (!rows.length) return [emptyCase(0)];
  return rows.map((r, idx) => ({
    clientKey: r.id,
    id: r.id,
    case_label: r.case_label ?? `Case ${idx + 1}`,
    patient_reference: r.patient_reference ?? "",
    patient_email: r.patient_email ?? "",
    graft_count: r.graft_count,
    hair_count: r.hair_count,
    case_specific_notes: r.case_specific_notes ?? "",
  }));
}

function intakeChip(status: string) {
  if (status === "ready_for_audit") return "bg-emerald-900/50 text-emerald-200";
  if (status === "incomplete") return "bg-amber-900/40 text-amber-200";
  return "bg-slate-700 text-slate-300";
}

export default function BulkUploadWizardClient({ batch, initialCases, initialImages }: WizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [batchDetails, setBatchDetails] = useState(() => batchToInput(batch));
  const [cases, setCases] = useState<BulkCaseDraftInput[]>(() => casesToDraft(initialCases));
  const [savedCases, setSavedCases] = useState<BulkCaseRow[]>(initialCases);
  const [images, setImages] = useState<BulkCaseImageRow[]>(initialImages);
  const [clinics, setClinics] = useState<BulkProfileClinicOption[]>([]);
  const [doctors, setDoctors] = useState<BulkProfileDoctorOption[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [bulkAssignCaseId, setBulkAssignCaseId] = useState("");
  const [bulkAssignCategory, setBulkAssignCategory] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadQueueRef = useRef(new UploadQueue(UPLOAD_LIMITS.MAX_CONCURRENT_UPLOADS));
  const [dragDepth, setDragDepth] = useState(0);

  useEffect(() => {
    void fetch("/api/admin/hair-audit/bulk-upload/profiles")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setClinics(j.clinics ?? []);
          setDoctors(j.doctors ?? []);
        }
      })
      .catch(() => {});
  }, []);

  const imageCountByCase = useMemo(() => {
    const m = new Map<string, number>();
    for (const img of images) {
      if (!img.case_id) continue;
      m.set(img.case_id, (m.get(img.case_id) ?? 0) + 1);
    }
    return m;
  }, [images]);

  const caseReadiness = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeCaseReadiness>>();
    for (const c of savedCases) {
      m.set(
        c.id,
        computeCaseReadiness(
          {
            patient_reference: c.patient_reference ?? "",
            graft_count: c.graft_count,
          },
          imageCountByCase.get(c.id) ?? 0
        )
      );
    }
    return m;
  }, [savedCases, imageCountByCase]);

  const refreshBatch = useCallback(async () => {
    const res = await fetch(`/api/admin/hair-audit/bulk-upload/batches/${batch.id}`);
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      setSavedCases(j.cases ?? []);
      setImages(j.images ?? []);
      setCases(casesToDraft(j.cases ?? []));
    }
  }, [batch.id]);

  async function saveBatchDetails() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/hair-audit/bulk-upload/batches/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchDetails),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Save failed");
      setMsg("Batch details saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveCasesDraft() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const batchRes = await fetch(`/api/admin/hair-audit/bulk-upload/batches/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchDetails),
      });
      const batchJson = await batchRes.json().catch(() => ({}));
      if (!batchRes.ok) throw new Error(typeof batchJson.error === "string" ? batchJson.error : "Save failed");

      const res = await fetch(`/api/admin/hair-audit/bulk-upload/batches/${batch.id}/cases`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cases }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Save failed");
      setSavedCases(j.cases ?? []);
      setCases(casesToDraft(j.cases ?? []));
      setMsg("Draft batch saved.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const list = Array.from(fileList).filter(
      (f) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(f.name)
    );
    if (!list.length) {
      setErr("No supported images selected.");
      return;
    }
    setUploadBusy(true);
    setErr(null);
    setMsg(null);
    let ok = 0;
    let lastError: string | null = null;
    try {
      await Promise.all(
        list.map((file) =>
          uploadQueueRef.current.execute(async () => {
            const fd = new FormData();
            fd.set("batchId", batch.id);
            fd.set("file", file);
            if (bulkAssignCaseId) fd.set("caseId", bulkAssignCaseId);
            if (bulkAssignCategory) fd.set("category", bulkAssignCategory);
            const res = await fetch("/api/admin/hair-audit/bulk-upload/images", { method: "POST", body: fd });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) {
              lastError = typeof j.error === "string" ? j.error : "Upload failed";
              return;
            }
            if (j.image) {
              setImages((prev) => [...prev, j.image as BulkCaseImageRow]);
              ok++;
            }
          })
        )
      );
      if (lastError && ok === 0) setErr(lastError);
      else setMsg(`Uploaded ${ok} image${ok === 1 ? "" : "s"}.`);
    } finally {
      setUploadBusy(false);
    }
  }

  async function patchImages(imageIds: string[], payload: { caseId?: string | null; category?: string | null }) {
    if (!imageIds.length) return;
    const res = await fetch("/api/admin/hair-audit/bulk-upload/images", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds, ...payload }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Update failed");
    if (Array.isArray(j.images)) {
      const updated = j.images as BulkCaseImageRow[];
      setImages((prev) => {
        const byId = new Map(updated.map((row) => [row.id, row]));
        return prev.map((row) => byId.get(row.id) ?? row);
      });
    } else {
      await refreshBatch();
    }
  }

  async function bulkPatchImages(payload: { caseId?: string | null; category?: string | null }) {
    if (!selectedImageIds.size) {
      setErr("Select at least one image.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await patchImages([...selectedImageIds], payload);
      setSelectedImageIds(new Set());
      setMsg("Images updated.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedImages() {
    if (!selectedImageIds.size) return;
    setBusy(true);
    setErr(null);
    try {
      await Promise.all(
        [...selectedImageIds].map((id) =>
          fetch(`/api/admin/hair-audit/bulk-upload/images/${id}`, { method: "DELETE" })
        )
      );
      setImages((prev) => prev.filter((img) => !selectedImageIds.has(img.id)));
      setSelectedImageIds(new Set());
      setMsg("Selected images deleted.");
    } catch {
      setErr("Could not delete some images.");
    } finally {
      setBusy(false);
    }
  }

  async function markCaseReady(caseId: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/hair-audit/bulk-upload/cases/${caseId}/ready`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const missing = Array.isArray(j.missingFields) ? j.missingFields.join(", ") : j.error;
        throw new Error(typeof missing === "string" ? missing : "Could not mark ready");
      }
      await refreshBatch();
      setMsg("Case marked ready for audit.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not mark ready");
    } finally {
      setBusy(false);
    }
  }

  function toggleImage(id: string) {
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sharedNotice = [
    batchDetails.shared_surgery_date && `Surgery date: ${batchDetails.shared_surgery_date}`,
    batchDetails.shared_location && `Location: ${batchDetails.shared_location}`,
    batchDetails.shared_punch_size && `Punch: ${batchDetails.shared_punch_size}`,
    batchDetails.shared_extraction_method && `Extraction: ${batchDetails.shared_extraction_method}`,
    batchDetails.shared_implantation_method && `Implantation: ${batchDetails.shared_implantation_method}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/hair-audit/bulk-upload" className="text-sm text-slate-400 hover:text-cyan-300">
            ← All batches
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">{batchDetails.batch_name}</h1>
          {sharedNotice ? (
            <p className="mt-2 text-xs text-cyan-200/80">Inherited for all cases: {sharedNotice}</p>
          ) : null}
        </div>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, idx) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(idx)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                step === idx ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {idx + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {msg ? <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200">{msg}</p> : null}
      {err ? <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">{err}</p> : null}

      {step === 0 ? (
        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white">Batch details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-slate-400">Batch name</span>
              <input
                value={batchDetails.batch_name}
                onChange={(e) => setBatchDetails((d) => ({ ...d, batch_name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <BulkBatchProfessionalsPickers
              batch={batch}
              batchDetails={batchDetails}
              setBatchDetails={setBatchDetails}
              doctors={doctors}
              setDoctors={setDoctors}
              clinics={clinics}
              setClinics={setClinics}
              setErr={setErr}
              busy={busy}
              setBusy={setBusy}
            />
            {[
              ["shared_surgery_date", "Surgery date", "date"],
              ["shared_location", "Location / clinic site", "text"],
              ["shared_punch_type", "Punch type", "text"],
              ["shared_punch_size", "Punch size", "text"],
              ["shared_extraction_method", "Extraction method", "text"],
              ["shared_implantation_method", "Implantation method", "text"],
            ].map(([key, label, type]) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-slate-400">{label}</span>
                <input
                  type={type}
                  value={(batchDetails as Record<string, string | null>)[key] ?? ""}
                  onChange={(e) =>
                    setBatchDetails((d) => ({
                      ...d,
                      [key]: e.target.value || (type === "date" ? null : ""),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
            ))}
            {[
              ["shared_equipment_notes", "Equipment notes"],
              ["shared_preservation_notes", "Preservation notes"],
              ["shared_general_notes", "General notes"],
            ].map(([key, label]) => (
              <label key={key} className="block md:col-span-2">
                <span className="text-xs font-medium text-slate-400">{label}</span>
                <textarea
                  rows={3}
                  value={(batchDetails as Record<string, string>)[key] ?? ""}
                  onChange={(e) => setBatchDetails((d) => ({ ...d, [key]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveBatchDetails()}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              Save batch details
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              Continue to cases
            </button>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">Cases</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCases((prev) => [...prev, emptyCase(prev.length)])}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
              >
                Add case
              </button>
              <button
                type="button"
                onClick={() => {
                  const last = cases[cases.length - 1];
                  if (!last) return;
                  setCases((prev) => [
                    ...prev,
                    {
                      ...last,
                      clientKey: crypto.randomUUID(),
                      id: undefined,
                      case_label: `Case ${prev.length + 1}`,
                      patient_reference: "",
                      patient_email: "",
                    },
                  ]);
                }}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
              >
                Duplicate structure
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {cases.map((c, idx) => {
              const readiness = computeCaseReadiness(c, c.id ? imageCountByCase.get(c.id) ?? 0 : 0);
              return (
                <div key={c.clientKey} className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">{c.case_label}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${intakeChip(readiness.intakeStatus)}`}>
                      {readiness.intakeStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs text-slate-400">Case label</span>
                      <input
                        value={c.case_label}
                        onChange={(e) =>
                          setCases((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, case_label: e.target.value } : row))
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-400">Patient name or initials</span>
                      <input
                        value={c.patient_reference}
                        onChange={(e) =>
                          setCases((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, patient_reference: e.target.value } : row))
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-400">Patient email (optional)</span>
                      <input
                        type="email"
                        value={c.patient_email}
                        onChange={(e) =>
                          setCases((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, patient_email: e.target.value } : row))
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-400">Graft count</span>
                      <input
                        type="number"
                        value={c.graft_count ?? ""}
                        onChange={(e) =>
                          setCases((prev) =>
                            prev.map((row, i) =>
                              i === idx
                                ? { ...row, graft_count: e.target.value ? Number(e.target.value) : null }
                                : row
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-400">Hair count</span>
                      <input
                        type="number"
                        value={c.hair_count ?? ""}
                        onChange={(e) =>
                          setCases((prev) =>
                            prev.map((row, i) =>
                              i === idx
                                ? { ...row, hair_count: e.target.value ? Number(e.target.value) : null }
                                : row
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-xs text-slate-400">Case notes</span>
                      <textarea
                        rows={2}
                        value={c.case_specific_notes}
                        onChange={(e) =>
                          setCases((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, case_specific_notes: e.target.value } : row))
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveCasesDraft()}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              Save draft batch
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              Continue to images
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <div
            className={`rounded-xl border border-dashed p-8 text-center transition-colors ${
              dragDepth > 0 ? "border-cyan-400 bg-cyan-950/20" : "border-white/20 bg-slate-900/40"
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragDepth((d) => d + 1);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragDepth((d) => Math.max(0, d - 1));
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDragDepth(0);
              if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
            }}
          >
            <p className="text-sm text-slate-300">Drag and drop images here, or choose files</p>
            <button
              type="button"
              disabled={uploadBusy}
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {uploadBusy ? "Uploading…" : "Choose images"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs">
              <label className="text-slate-400">
                Default case on upload
                <select
                  value={bulkAssignCaseId}
                  onChange={(e) => setBulkAssignCaseId(e.target.value)}
                  className="ml-2 rounded border border-white/10 bg-slate-950 px-2 py-1 text-white"
                >
                  <option value="">Unassigned</option>
                  {savedCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_label ?? c.title ?? c.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-slate-400">
                Default category
                <select
                  value={bulkAssignCategory}
                  onChange={(e) => setBulkAssignCategory(e.target.value)}
                  className="ml-2 rounded border border-white/10 bg-slate-950 px-2 py-1 text-white"
                >
                  <option value="">None</option>
                  {BULK_IMAGE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {selectedImageIds.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 p-3">
              <span className="text-xs text-slate-400">{selectedImageIds.size} selected</span>
              <select
                value={bulkAssignCaseId}
                onChange={(e) => setBulkAssignCaseId(e.target.value)}
                className="rounded border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white"
              >
                <option value="">Assign to case…</option>
                {savedCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_label ?? c.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !bulkAssignCaseId}
                onClick={() => void bulkPatchImages({ caseId: bulkAssignCaseId })}
                className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                Assign case
              </button>
              <select
                value={bulkAssignCategory}
                onChange={(e) => setBulkAssignCategory(e.target.value)}
                className="rounded border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white"
              >
                <option value="">Category…</option>
                {BULK_IMAGE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !bulkAssignCategory}
                onClick={() => void bulkPatchImages({ category: bulkAssignCategory })}
                className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                Assign category
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteSelectedImages()}
                className="rounded bg-red-900/60 px-2 py-1 text-xs font-semibold text-red-100 disabled:opacity-50"
              >
                Delete selected
              </button>
            </div>
          ) : null}

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {images.map((img) => {
              const caseLabel =
                savedCases.find((c) => c.id === img.case_id)?.case_label ?? "Unassigned";
              return (
                <li
                  key={img.id}
                  className={`rounded-lg border p-2 ${
                    selectedImageIds.has(img.id) ? "border-cyan-400 bg-cyan-950/20" : "border-white/10 bg-slate-900/60"
                  }`}
                >
                  <button type="button" onClick={() => toggleImage(img.id)} className="block w-full text-left">
                    <BulkImageThumb storagePath={img.storage_path} fileName={img.file_name} />
                  </button>
                  <p className="mt-1 truncate text-[10px] text-slate-400">{caseLabel}</p>
                  <select
                    value={img.case_id ?? ""}
                    onChange={(e) => {
                      const caseId = e.target.value || null;
                      void patchImages([img.id], { caseId }).catch((error) =>
                        setErr(error instanceof Error ? error.message : "Update failed")
                      );
                    }}
                    className="mt-1 w-full rounded border border-white/10 bg-slate-950 px-1 py-0.5 text-[10px] text-white"
                  >
                    <option value="">Unassigned</option>
                    {savedCases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.case_label ?? c.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={img.image_category ?? ""}
                    onChange={(e) => {
                      const category = e.target.value || null;
                      void patchImages([img.id], { category }).catch((error) =>
                        setErr(error instanceof Error ? error.message : "Update failed")
                      );
                    }}
                    className="mt-1 w-full rounded border border-white/10 bg-slate-950 px-1 py-0.5 text-[10px] text-white"
                  >
                    <option value="">Category…</option>
                    {BULK_IMAGE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              Continue to review
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Review</h2>
          {savedCases.length === 0 ? (
            <p className="text-sm text-slate-400">Save at least one case before review.</p>
          ) : (
            savedCases.map((c) => {
              const readiness = caseReadiness.get(c.id) ?? computeCaseReadiness(casesToDraft([c])[0], 0);
              return (
                <div key={c.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">{c.case_label ?? c.title}</h3>
                      <p className="mt-1 text-sm text-slate-300">
                        {c.patient_reference || "No patient reference"} · {readiness.imageCount} image
                        {readiness.imageCount === 1 ? "" : "s"}
                        {c.graft_count != null ? ` · ${c.graft_count} grafts` : ""}
                      </p>
                      {readiness.missingFields.length ? (
                        <p className="mt-2 text-xs text-amber-200">
                          Missing: {readiness.missingFields.join(", ")}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-emerald-200">All required fields present</p>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${intakeChip(c.intake_status ?? readiness.intakeStatus)}`}>
                      {(c.intake_status ?? readiness.intakeStatus).replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || !readiness.isReady}
                      onClick={() => void markCaseReady(c.id)}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      Mark ready for audit
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
                    >
                      Continue editing
                    </button>
                    <Link
                      href={`/cases/${c.id}?from=bulk-upload`}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-white/5"
                    >
                      Open case review
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </section>
      ) : null}
    </div>
  );
}
