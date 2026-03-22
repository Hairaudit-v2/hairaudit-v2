"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AUDITOR_REASSIGNABLE_CATEGORY_KEYS, auditorPatientPhotoCategoryLabel } from "@/lib/auditor/auditorPatientPhotoCategories";
import { getMissingRequiredPatientPhotoCategories } from "@/lib/photoCategories";
import {
  displayNameFromPatientUpload,
  isPatientUploadAuditExcluded,
  storagePathPatientCategoryFolder,
} from "@/lib/uploads/patientPhotoAuditMeta";
import {
  resolvePatientPhotoCategoryKeyAligned,
  type PatientPhotoCategoryIntegritySummary,
} from "@/lib/uploads/patientPhotoCategoryIntegrity";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  signedUrl?: string | null;
  categoryIntegrity?: { needsAttention: boolean; issues: string[] };
};

function categoryFromRow(u: UploadRow): string {
  return resolvePatientPhotoCategoryKeyAligned(u) ?? "uncategorized";
}

export default function AuditorPatientImageManager({ caseId }: { caseId: string }) {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [integritySummary, setIntegritySummary] = useState<PatientPhotoCategoryIntegritySummary | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auditor/patient-uploads?caseId=${encodeURIComponent(caseId)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to load uploads");
      setUploads(json.uploads ?? []);
      setIntegritySummary((json.categoryIntegritySummary ?? null) as PatientPhotoCategoryIntegritySummary | null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setUploads([]);
      setIntegritySummary(null);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const byCategory = useMemo(() => {
    const m = new Map<string, UploadRow[]>();
    for (const u of uploads) {
      const c = categoryFromRow(u);
      const arr = m.get(c) ?? [];
      arr.push(u);
      m.set(c, arr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [uploads]);

  const missingRequired = useMemo(() => {
    const active = uploads.filter((u) => !isPatientUploadAuditExcluded(u));
    return getMissingRequiredPatientPhotoCategories(active.map((u) => ({ type: u.type })));
  }, [uploads]);

  async function patchUpload(uploadId: string, body: Record<string, unknown>) {
    setBusyId(uploadId);
    setMessage(null);
    try {
      const res = await fetch("/api/auditor/patient-uploads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, uploadId, ...body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Update failed");
      setMessage("Saved.");
      await load();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-400">Loading patient photos…</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  if (!uploads.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">
            Patient photo corrections
            <span className="ml-2 rounded-md border border-slate-600 bg-slate-800 px-2 py-0.5 font-mono text-xs font-normal text-slate-300">
              {uploads.length} upload{uploads.length === 1 ? "" : "s"}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Reassign categories (updates audit metadata; storage path unchanged). Rename is auditor-facing only. Excluded images
            stay visible here but are skipped by automated audit preparation. Photos are grouped by effective category—scroll through
            every section to see all rows; the count above matches the API.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      {missingRequired.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <span className="font-semibold">Required patient photo slots still empty (non-excluded only): </span>
          {missingRequired.join(", ")}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          Required Basic Audit photo categories are satisfied for active (non-excluded) uploads.
        </div>
      )}

      {message ? (
        <p className={`mt-2 text-xs ${message === "Saved." ? "text-emerald-300" : "text-rose-300"}`}>{message}</p>
      ) : null}

      {integritySummary && integritySummary.rowsNeedingAttention > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <p className="font-semibold text-amber-50">
            Category integrity: {integritySummary.rowsNeedingAttention} / {integritySummary.patientPhotoCount} patient photo(s)
            need review (type vs metadata.category).
          </p>
          {integritySummary.samples.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-amber-100/90">
              {integritySummary.samples.slice(0, 5).map((s) => (
                <li key={s.uploadId}>
                  <span className="font-mono">{s.uploadId.slice(0, 8)}…</span>: {s.issues[0] ?? "issue"}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-6">
        {byCategory.map(([cat, rows]) => (
          <div key={cat}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {auditorPatientPhotoCategoryLabel(cat)}
              <span className="ml-2 font-mono font-normal text-slate-600">({cat})</span>
            </h3>
            <ul className="mt-2 space-y-2">
              {rows.map((u) => {
                const excluded = isPatientUploadAuditExcluded(u);
                const name = displayNameFromPatientUpload(u);
                const disabled = busyId === u.id;
                return (
                  <li
                    key={u.id}
                    className={`flex flex-wrap items-center gap-3 rounded-lg border px-2 py-2 ${
                      excluded ? "border-rose-500/30 bg-rose-950/20" : "border-slate-700 bg-slate-950/50"
                    }`}
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-slate-700 bg-slate-800">
                      {u.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.signedUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-slate-500">No URL</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-100">{name}</div>
                      <div className="truncate font-mono text-[11px] text-slate-500">{u.storage_path}</div>
                      {(() => {
                        const folder = storagePathPatientCategoryFolder(u.storage_path);
                        if (!folder || folder === cat) return null;
                        return (
                          <p className="mt-0.5 text-[10px] text-amber-200/90">
                            Storage folder “{folder}” differs from effective category “{cat}” (expected after reassignment without
                            file move).
                          </p>
                        );
                      })()}
                      {excluded ? (
                        <span className="mt-1 inline-block rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200">
                          Excluded from audit
                        </span>
                      ) : null}
                      {u.categoryIntegrity?.needsAttention ? (
                        <span
                          className="mt-1 inline-block rounded border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100"
                          title={u.categoryIntegrity.issues.join("\n")}
                        >
                          Category mismatch (debug)
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        disabled={disabled}
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          e.target.value = "";
                          if (!v || v === cat) return;
                          void patchUpload(u.id, { action: "reassign", category: v });
                        }}
                        className="max-w-[200px] rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                        aria-label={`Move ${name} to category`}
                      >
                        <option value="">Move to…</option>
                        {AUDITOR_REASSIGNABLE_CATEGORY_KEYS.filter((k) => k !== cat).map((k) => (
                          <option key={k} value={k}>
                            {auditorPatientPhotoCategoryLabel(k)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          const next = window.prompt("Display filename (auditor-facing only, empty to clear)", name);
                          if (next === null) return;
                          void patchUpload(u.id, { action: "rename", displayName: next.trim() === "" ? null : next.trim() });
                        }}
                        className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                      >
                        Rename
                      </button>
                      {excluded ? (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => patchUpload(u.id, { action: "restore" })}
                          className="rounded-md border border-emerald-600/50 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-950/40"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (!window.confirm("Exclude this image from automated audit use? (File is kept.)")) return;
                            void patchUpload(u.id, { action: "exclude" });
                          }}
                          className="rounded-md border border-rose-600/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-950/30"
                        >
                          Exclude
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        After corrections, use <strong className="text-slate-300">Auditor Rerun</strong> below with reason{" "}
        <strong className="text-slate-300">&quot;Corrected patient photos&quot;</strong> so scoring and evidence use the updated
        assignments.
      </p>
    </section>
  );
}
