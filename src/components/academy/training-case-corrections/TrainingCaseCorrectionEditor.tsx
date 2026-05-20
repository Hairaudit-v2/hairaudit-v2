"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ACADEMY_OPTIONAL_PHOTO_CATEGORIES,
  ACADEMY_REQUIRED_PHOTO_CATEGORIES,
} from "@/lib/academy/constants";
import { TRAINING_CASE_STATUSES } from "@/lib/academy/trainingCaseCorrections/constants";
import { deriveTrainingCaseMetrics } from "@/lib/academy/trainingCaseMetricsDerived";
import { parseTrainingPhotoType } from "@/lib/academy/photoCategories";
import type { TrainingCaseRow, TrainingCaseUploadRow } from "@/lib/academy/types";
import AcademySignedThumb from "@/components/academy/AcademySignedThumb";

type DoctorOption = { id: string; full_name: string };
type TrainerOption = { user_id: string; display_name: string | null };

type MetricsInitial = Record<string, string | number | boolean | null | undefined>;

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function toTimeInput(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : "";
}

function parseIntField(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

const PHOTO_CATEGORIES = [...ACADEMY_REQUIRED_PHOTO_CATEGORIES, ...ACADEMY_OPTIONAL_PHOTO_CATEGORIES];

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">Reason for correction *</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        required
        placeholder="Example: Incorrect graft count entered during upload. Corrected from surgical worksheet."
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

export default function TrainingCaseCorrectionEditor({
  caseId,
  initialCase,
  initialMetrics,
  uploads,
  doctors,
  trainers,
  isAdmin,
}: {
  caseId: string;
  initialCase: TrainingCaseRow;
  initialMetrics: MetricsInitial;
  uploads: TrainingCaseUploadRow[];
  doctors: DoctorOption[];
  trainers: TrainerOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [surgeryDate, setSurgeryDate] = useState(initialCase.surgery_date);
  const [doctorId, setDoctorId] = useState(initialCase.training_doctor_id);
  const [trainerId, setTrainerId] = useState(initialCase.trainer_id);
  const [procedureType, setProcedureType] = useState(initialCase.procedure_type ?? "");
  const [complexity, setComplexity] = useState(initialCase.complexity_level ?? "");
  const [patientSex, setPatientSex] = useState(initialCase.patient_sex ?? "");
  const [ageBand, setPatientAgeBand] = useState(initialCase.patient_age_band ?? "");
  const [notes, setNotes] = useState(initialCase.notes ?? "");
  const [status, setStatus] = useState(initialCase.status);
  const [detailsReason, setDetailsReason] = useState("");

  const [graftsAttempted, setGraftsAttempted] = useState(() => toStr(initialMetrics.grafts_attempted));
  const [graftsExtracted, setGraftsExtracted] = useState(() => toStr(initialMetrics.grafts_extracted));
  const [graftsImplanted, setGraftsImplanted] = useState(() => toStr(initialMetrics.grafts_implanted));
  const [totalHairs, setTotalHairs] = useState(() => toStr(initialMetrics.total_hairs));
  const [extStart, setExtStart] = useState(() => toTimeInput(initialMetrics.extraction_start_time));
  const [extEnd, setExtEnd] = useState(() => toTimeInput(initialMetrics.extraction_end_time));
  const [impStart, setImpStart] = useState(() => toTimeInput(initialMetrics.implantation_start_time));
  const [impEnd, setImpEnd] = useState(() => toTimeInput(initialMetrics.implantation_end_time));
  const [punchSize, setPunchSize] = useState(() => toStr(initialMetrics.punch_size));
  const [punchType, setPunchType] = useState(() => toStr(initialMetrics.punch_type));
  const [implantMethod, setImplantMethod] = useState(() => toStr(initialMetrics.implantation_method));
  const [observed, setObserved] = useState(() => Boolean(initialMetrics.observed_by_trainer));
  const [transectCount, setTransectCount] = useState(() => toStr(initialMetrics.transected_grafts_count));
  const [buriedCount, setBuriedCount] = useState(() => toStr(initialMetrics.buried_grafts_count));
  const [poppedCount, setPoppedCount] = useState(() => toStr(initialMetrics.popped_grafts_count));
  const [metricsReason, setMetricsReason] = useState("");
  const [ackHairWarning, setAckHairWarning] = useState(false);

  const [adminReason, setAdminReason] = useState("");

  const derived = useMemo(
    () =>
      deriveTrainingCaseMetrics({
        grafts_attempted: parseIntField(graftsAttempted),
        grafts_extracted: parseIntField(graftsExtracted),
        grafts_implanted: parseIntField(graftsImplanted),
        total_hairs: parseIntField(totalHairs),
        extraction_start_time: extStart.trim() || null,
        extraction_end_time: extEnd.trim() || null,
        implantation_start_time: impStart.trim() || null,
        implantation_end_time: impEnd.trim() || null,
        transected_grafts_count: parseIntField(transectCount),
        buried_grafts_count: parseIntField(buriedCount),
        popped_grafts_count: parseIntField(poppedCount),
      }),
    [graftsAttempted, graftsExtracted, graftsImplanted, totalHairs, extStart, extEnd, impStart, impEnd, transectCount, buriedCount, poppedCount]
  );

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/academy/cases/${caseId}/corrections/details`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: detailsReason,
        surgery_date: surgeryDate,
        training_doctor_id: doctorId,
        trainer_id: trainerId,
        procedure_type: procedureType.trim() || null,
        complexity_level: complexity.trim() || null,
        patient_sex: patientSex.trim() || null,
        patient_age_band: ageBand.trim() || null,
        notes: notes.trim() || null,
        status,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || "Could not save case details");
      return;
    }
    setMsg("Case details saved.");
    router.refresh();
  }

  async function saveMetrics(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/academy/cases/${caseId}/corrections/metrics`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: metricsReason,
        acknowledgeHairWarning: ackHairWarning,
        metrics: {
          grafts_attempted: parseIntField(graftsAttempted),
          grafts_extracted: parseIntField(graftsExtracted),
          grafts_implanted: parseIntField(graftsImplanted),
          total_hairs: parseIntField(totalHairs),
          extraction_start_time: extStart.trim() || null,
          extraction_end_time: extEnd.trim() || null,
          implantation_start_time: impStart.trim() || null,
          implantation_end_time: impEnd.trim() || null,
          punch_size: punchSize.trim() || null,
          punch_type: punchType.trim() || null,
          implantation_method: implantMethod.trim() || null,
          observed_by_trainer: observed,
          transected_grafts_count: parseIntField(transectCount),
          buried_grafts_count: parseIntField(buriedCount),
          popped_grafts_count: parseIntField(poppedCount),
        },
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.status === 409 && j.code === "hair_below_grafts") {
      setErr(j.error);
      return;
    }
    if (!res.ok) {
      setErr(j.error || "Could not save metrics");
      return;
    }
    setMsg("Metrics saved with recalculated derived values.");
    setAckHairWarning(false);
    router.refresh();
  }

  async function archiveCase(mode: "archived" | "voided") {
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/academy/cases/${caseId}/corrections/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: adminReason, mode }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || "Archive failed");
      return;
    }
    setMsg(mode === "voided" ? "Case voided." : "Case archived.");
    router.push(`/academy/cases/${caseId}?corrected=1`);
  }

  async function restoreCase() {
    setErr(null);
    const res = await fetch(`/api/academy/cases/${caseId}/corrections/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: adminReason }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || "Restore failed");
      return;
    }
    setMsg("Case restored to draft.");
    router.refresh();
  }

  async function softDeleteCase() {
    if (!confirm("Soft-delete this case? It will be hidden from trainee views.")) return;
    setErr(null);
    const res = await fetch(`/api/academy/cases/${caseId}/corrections/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: adminReason }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || "Delete failed");
      return;
    }
    router.push("/academy/training-cases");
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Changes made here may affect trainee metrics, competency tracking, and case review outcomes.
      </div>

      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
          {err.includes("confirm") ? (
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={ackHairWarning} onChange={(e) => setAckHairWarning(e.target.checked)} />
              I confirm hair count below graft count is intentional
            </label>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={saveDetails} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Case details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Surgery date</label>
            <input type="date" value={surgeryDate} onChange={(e) => setSurgeryDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm capitalize">
              {TRAINING_CASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Trainee</label>
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Supervising trainer</label>
            <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {trainers.map((t) => (
                <option key={t.user_id} value={t.user_id}>
                  {t.display_name || t.user_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Procedure</label>
            <input value={procedureType} onChange={(e) => setProcedureType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Complexity</label>
            <input value={complexity} onChange={(e) => setComplexity(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Patient sex</label>
            <input value={patientSex} onChange={(e) => setPatientSex(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Age band</label>
            <input value={ageBand} onChange={(e) => setPatientAgeBand(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <ReasonField value={detailsReason} onChange={setDetailsReason} />
        <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          Save case details
        </button>
      </form>

      <form onSubmit={saveMetrics} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Surgical numbers & timings</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-slate-600">Grafts attempted</label>
            <input value={graftsAttempted} onChange={(e) => setGraftsAttempted(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Grafts extracted</label>
            <input value={graftsExtracted} onChange={(e) => setGraftsExtracted(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Grafts implanted</label>
            <input value={graftsImplanted} onChange={(e) => setGraftsImplanted(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Total hairs</label>
            <input value={totalHairs} onChange={(e) => setTotalHairs(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Transected</label>
            <input value={transectCount} onChange={(e) => setTransectCount(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Buried</label>
            <input value={buriedCount} onChange={(e) => setBuriedCount(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Popped</label>
            <input value={poppedCount} onChange={(e) => setPoppedCount(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-slate-600">Punch size</label>
            <input value={punchSize} onChange={(e) => setPunchSize(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Punch type</label>
            <input value={punchType} onChange={(e) => setPunchType(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Implant method</label>
            <input value={implantMethod} onChange={(e) => setImplantMethod(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={observed} onChange={(e) => setObserved(e.target.checked)} />
          Observed by trainer
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-slate-600">Extraction</span>
            <div className="mt-1 flex gap-2">
              <input type="time" value={extStart} onChange={(e) => setExtStart(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
              <input type="time" value={extEnd} onChange={(e) => setExtEnd(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-600">Implantation</span>
            <div className="mt-1 flex gap-2">
              <input type="time" value={impStart} onChange={(e) => setImpStart(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
              <input type="time" value={impEnd} onChange={(e) => setImpEnd(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 text-xs text-slate-600">
          <div>Extraction {derived.extraction_minutes ?? "—"} min · {derived.extraction_grafts_per_hour ?? "—"} grafts/hr</div>
          <div>Implantation {derived.implantation_minutes ?? "—"} min · {derived.implantation_grafts_per_hour ?? "—"} grafts/hr</div>
          <div>Hair/graft {derived.hair_to_graft_ratio ?? "—"} · TOB est. {derived.out_of_body_time_estimate ?? "—"} min</div>
        </div>
        <ReasonField value={metricsReason} onChange={setMetricsReason} />
        <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          Save metrics
        </button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Uploaded images</h2>
        {uploads.length === 0 ? (
          <p className="text-sm text-slate-500">No active uploads.</p>
        ) : (
          <ul className="space-y-4">
            {uploads.map((u) => (
              <UploadCorrectionRow key={u.id} upload={u} onDone={() => router.refresh()} setErr={setErr} setMsg={setMsg} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-red-100 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Admin actions</h2>
        <ReasonField value={adminReason} onChange={setAdminReason} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => archiveCase("archived")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Archive case
          </button>
          <button type="button" onClick={() => archiveCase("voided")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Void case
          </button>
          <button type="button" onClick={() => restoreCase()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Restore case
          </button>
          <button type="button" onClick={() => softDeleteCase()} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50">
            Soft delete
          </button>
          {isAdmin ? (
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Permanently delete this case? Only use when no reviews exist.")) return;
                const res = await fetch(`/api/academy/cases/${caseId}/corrections/delete`, {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reason: adminReason }),
                });
                const j = await res.json().catch(() => ({}));
                if (!res.ok) setErr(j.error || "Hard delete failed");
                else router.push("/academy/training-cases");
              }}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800"
            >
              Hard delete (admin)
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function UploadCorrectionRow({
  upload,
  onDone,
  setErr,
  setMsg,
}: {
  upload: TrainingCaseUploadRow;
  onDone: () => void;
  setErr: (s: string | null) => void;
  setMsg: (s: string | null) => void;
}) {
  const currentCat = parseTrainingPhotoType(upload.type) ?? "";
  const [category, setCategory] = useState(currentCat);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const caption = typeof upload.metadata_json?.caption === "string" ? upload.metadata_json.caption : "";

  async function saveCategory() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/academy/uploads/${upload.id}/corrections`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, category, caption: caption || null }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "Could not update category");
      return;
    }
    setMsg("Upload category updated.");
    onDone();
  }

  async function remove() {
    if (!confirm("Remove this image? This is logged in the correction history.")) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/academy/uploads/${upload.id}/corrections`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "Could not delete upload");
      return;
    }
    setMsg("Upload removed.");
    onDone();
  }

  return (
    <li className="flex flex-wrap gap-4 border-b border-slate-100 pb-4">
      <div className="w-28 shrink-0">
        <AcademySignedThumb storagePath={upload.storage_path} label={currentCat || "photo"} />
      </div>
      <div className="flex-1 min-w-[200px] space-y-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
          {PHOTO_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for correction"
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => saveCategory()} className="text-sm font-medium text-amber-700 hover:underline">
            Update category
          </button>
          <button type="button" disabled={busy} onClick={() => remove()} className="text-sm font-medium text-red-700 hover:underline">
            Delete image
          </button>
        </div>
      </div>
    </li>
  );
}
