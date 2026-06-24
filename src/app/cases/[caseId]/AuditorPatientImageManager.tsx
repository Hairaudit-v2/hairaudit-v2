"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuditorImageCategorySelectCompact } from "@/components/auditor/AuditorImageCategorySelect";
import AuditorImageSortCard, {
  AuditorImageSortCardLightbox,
  type AuditorImageSortCardUpload,
} from "@/components/auditor/AuditorImageSortCard";
import { auditorPatientPhotoCategoryLabel } from "@/lib/auditor/auditorPatientPhotoCategories";
import {
  buildRequiredPhotoChecklist,
  filterLikelyMatchesForCategory,
  sortUploadsForAuditorReview,
} from "@/lib/auditor/auditorImageSortingUx";
import {
  DEFAULT_PATIENT_REVIEW_PATHWAY,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import { isPatientUploadAuditExcluded, displayNameFromPatientUpload } from "@/lib/uploads/patientPhotoAuditMeta";
import {
  resolvePatientPhotoCategoryKeyAligned,
  type PatientPhotoCategoryIntegritySummary,
} from "@/lib/uploads/patientPhotoCategoryIntegrity";

type UploadRow = AuditorImageSortCardUpload;

function categoryFromRow(u: UploadRow): string {
  return resolvePatientPhotoCategoryKeyAligned(u) ?? "uncategorized";
}

function qualityWarningFromUpload(u: UploadRow): string | null {
  const meta = u.metadata;
  if (!meta || typeof meta !== "object") return null;
  const w = (meta as Record<string, unknown>).quality_warning;
  return typeof w === "string" && w.trim() ? w.trim() : null;
}

export default function AuditorPatientImageManager({
  caseId,
  patientReviewPathway: pathwayProp,
}: {
  caseId: string;
  patientReviewPathway?: PatientReviewPathway;
}) {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [pathway, setPathway] = useState<PatientReviewPathway>(
    pathwayProp ?? DEFAULT_PATIENT_REVIEW_PATHWAY
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [integritySummary, setIntegritySummary] = useState<PatientPhotoCategoryIntegritySummary | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingAssignCategory, setPendingAssignCategory] = useState<string | null>(null);
  const [likelyMatchFilter, setLikelyMatchFilter] = useState<string | null>(null);
  const [lightboxUpload, setLightboxUpload] = useState<UploadRow | null>(null);
  const [showAdvancedBulk, setShowAdvancedBulk] = useState(false);

  useEffect(() => {
    if (pathwayProp) setPathway(pathwayProp);
  }, [pathwayProp]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auditor/patient-uploads?caseId=${encodeURIComponent(caseId)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to load uploads");
      setUploads(json.uploads ?? []);
      setIntegritySummary((json.categoryIntegritySummary ?? null) as PatientPhotoCategoryIntegritySummary | null);
      if (!pathwayProp && json.patientReviewPathway) {
        setPathway(json.patientReviewPathway as PatientReviewPathway);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setUploads([]);
      setIntegritySummary(null);
    } finally {
      setLoading(false);
    }
  }, [caseId, pathwayProp]);

  useEffect(() => {
    load();
  }, [load]);

  const activeUploads = useMemo(
    () => uploads.filter((u) => !isPatientUploadAuditExcluded(u)),
    [uploads]
  );

  const requiredChecklist = useMemo(
    () => buildRequiredPhotoChecklist(pathway, activeUploads),
    [pathway, activeUploads]
  );

  const sortedUploads = useMemo(
    () => sortUploadsForAuditorReview(uploads, pathway, categoryFromRow),
    [uploads, pathway]
  );

  const visibleUploads = useMemo(() => {
    if (!likelyMatchFilter) return sortedUploads;
    return filterLikelyMatchesForCategory(sortedUploads, likelyMatchFilter, categoryFromRow);
  }, [sortedUploads, likelyMatchFilter]);

  const qualityWarningCount = useMemo(
    () => uploads.filter((u) => qualityWarningFromUpload(u)).length,
    [uploads]
  );

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

  async function bulkReassign(categoryKey: string) {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkBusy(true);
    setMessage(null);
    try {
      for (const uploadId of ids) {
        const res = await fetch("/api/auditor/patient-uploads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, uploadId, action: "reassign", category: categoryKey }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Bulk update failed");
      }
      setMessage(`Assigned ${ids.length} image${ids.length === 1 ? "" : "s"}.`);
      setSelectedIds(new Set());
      await load();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-400">
        Loading patient photos…
      </div>
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

  const pathwayLabel = pathway === "pre_surgery" ? "Pre-surgery planning" : "Post-surgery audit";

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">
            Patient photo sorting
            <span className="ml-2 rounded-md border border-slate-600 bg-slate-800 px-2 py-0.5 font-mono text-xs font-normal text-slate-300">
              {uploads.length} upload{uploads.length === 1 ? "" : "s"}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {pathwayLabel} workflow — reassign categories (metadata only; originals unchanged). Use quick
            actions or bulk mode for faster sorting. After corrections, rerun with reason &quot;Corrected
            patient photos&quot;.
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

      <div className="mt-3 rounded-lg border border-slate-600/80 bg-slate-950/50 px-3 py-2">
        <p className="text-xs font-semibold text-slate-200">Required photo status</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {requiredChecklist.map((item) => (
            <li
              key={item.key}
              className={`flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1 text-xs ${
                item.satisfied
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-500/35 bg-amber-500/10 text-amber-100"
              }`}
            >
              <span>{item.satisfied ? "✓" : "✕"}</span>
              <span>{item.label}</span>
              {!item.satisfied ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingAssignCategory(item.key);
                      setLikelyMatchFilter(null);
                    }}
                    className="rounded border border-cyan-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/15"
                  >
                    Assign next selected
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLikelyMatchFilter(item.key);
                      setPendingAssignCategory(item.key);
                    }}
                    className="rounded border border-slate-500/50 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-800"
                  >
                    Filter likely matches
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        {pendingAssignCategory ? (
          <p className="mt-2 text-[11px] text-cyan-200/90">
            Pending assignment:{" "}
            <strong>{auditorPatientPhotoCategoryLabel(pendingAssignCategory)}</strong>
            <button
              type="button"
              onClick={() => setPendingAssignCategory(null)}
              className="ml-2 text-slate-400 underline hover:text-slate-200"
            >
              Clear
            </button>
          </p>
        ) : null}
        {likelyMatchFilter ? (
          <p className="mt-1 text-[11px] text-slate-400">
            Showing likely matches for {auditorPatientPhotoCategoryLabel(likelyMatchFilter)} (
            {visibleUploads.length} of {uploads.length})
            <button
              type="button"
              onClick={() => setLikelyMatchFilter(null)}
              className="ml-2 underline hover:text-slate-200"
            >
              Show all
            </button>
          </p>
        ) : null}
      </div>

      {qualityWarningCount > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <span className="font-semibold">Image quality advisories: </span>
          {qualityWarningCount} upload{qualityWarningCount === 1 ? "" : "s"} flagged at upload time.
        </div>
      ) : null}

      {message ? (
        <p className={`mt-2 text-xs ${message.startsWith("Assigned") || message === "Saved." ? "text-emerald-300" : "text-rose-300"}`}>
          {message}
        </p>
      ) : null}

      {integritySummary && integritySummary.rowsNeedingAttention > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <p className="font-semibold text-amber-50">
            Category integrity: {integritySummary.rowsNeedingAttention} / {integritySummary.patientPhotoCount}{" "}
            patient photo(s) need review.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
          <input
            type="checkbox"
            checked={bulkMode}
            onChange={(e) => {
              setBulkMode(e.target.checked);
              if (!e.target.checked) setSelectedIds(new Set());
            }}
            className="rounded border-slate-600"
          />
          Bulk sorting mode
        </label>
        {bulkMode ? (
          <>
            <span className="text-xs text-slate-400">{selectedIds.size} selected</span>
            <AuditorImageCategorySelectCompact
              pathway={pathway}
              showAdvanced={showAdvancedBulk}
              disabled={bulkBusy || selectedIds.size === 0}
              onChange={(cat) => void bulkReassign(cat)}
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-400">
              <input
                type="checkbox"
                checked={showAdvancedBulk}
                onChange={(e) => setShowAdvancedBulk(e.target.checked)}
                className="rounded border-slate-600"
              />
              Advanced in bulk
            </label>
          </>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visibleUploads.map((u) => {
          const cat = categoryFromRow(u);
          const disabled = busyId === u.id || bulkBusy;
          return (
            <AuditorImageSortCard
              key={u.id}
              upload={u}
              pathway={pathway}
              category={cat}
              disabled={disabled}
              bulkMode={bulkMode}
              bulkSelected={selectedIds.has(u.id)}
              pendingAssignCategory={pendingAssignCategory}
              onToggleBulk={() => toggleSelected(u.id)}
              onReassign={(categoryKey) => {
                if (categoryKey === cat) return;
                void patchUpload(u.id, { action: "reassign", category: categoryKey });
              }}
              onRename={() => {
                const name = displayNameFromPatientUpload(u);
                const next = window.prompt("Display filename (auditor-facing only, empty to clear)", name);
                if (next === null) return;
                void patchUpload(u.id, {
                  action: "rename",
                  displayName: next.trim() === "" ? null : next.trim(),
                });
              }}
              onExclude={() => {
                if (!window.confirm("Exclude this image from automated audit use? (File is kept.)")) return;
                void patchUpload(u.id, { action: "exclude" });
              }}
              onRestore={() => patchUpload(u.id, { action: "restore" })}
              onExpand={() => setLightboxUpload(u)}
            />
          );
        })}
      </div>

      {lightboxUpload ? (
        <AuditorImageSortCardLightbox
          upload={lightboxUpload}
          caseId={caseId}
          category={categoryFromRow(lightboxUpload)}
          onClose={() => setLightboxUpload(null)}
        />
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        Category changes are logged to upload audit corrections (previous category, new category, actor, upload
        id). Original files are never deleted or moved.
      </p>
    </section>
  );
}
