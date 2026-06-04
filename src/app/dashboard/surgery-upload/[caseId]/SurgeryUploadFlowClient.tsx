"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UploadedThumb from "@/components/uploads/UploadedThumb";
import ImageLightbox, { type LightboxUpload } from "@/components/uploads/ImageLightbox";
import { UPLOAD_LIMITS, UploadQueue, formatUploadErrorForUser } from "@/lib/uploads/safeUpload";
import { prepareImageForUpload } from "@/lib/uploads/compressImage";
import {
  slotFromSurgeryType,
  getResolvedSurgeryChecklist,
  getRequiredPhotoCompletion,
  type ResolvedSurgerySlot,
  type SurgeryPhotoSlotKey,
} from "@/lib/surgeryUpload/checklist";
import { SURGERY_PROCEDURE_TYPES, type SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";
import {
  evidenceReviewStatusLabel,
  slotReviewStatusLabel,
  type SurgerySlotReviewRow,
} from "@/lib/surgeryUpload/evidenceReview";
import SurgeryUploadEvidenceTimeline from "@/components/surgery-upload/SurgeryUploadEvidenceTimeline";
import SurgeryPhotoExportPackButton from "@/components/surgery-upload/SurgeryPhotoExportPackButton";
import { type EvidenceTimelineEvent } from "@/lib/surgeryUpload/evidenceEvents";
import {
  auditIntakeStatusLabel,
  type AuditIntakeStatus,
} from "@/lib/surgeryUpload/auditIntake";
import {
  clearLocalSurgeryDraft,
  diffRecoverableValues,
  hasMeaningfulLocalDifferences,
  loadLocalSurgeryDraft,
  pickRecoverableValues,
  saveLocalSurgeryDraft,
  type LocalSurgeryDraft,
} from "@/lib/surgeryUpload/localDraftRecovery";

export type SurgeryUploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata: unknown;
  created_at: string;
};

const uploadQueue = new UploadQueue(UPLOAD_LIMITS.MAX_CONCURRENT_UPLOADS);
const PHOTO_API = "/api/surgery-upload/photos";

const COMPRESS_OPTS = { maxEdge: 2400, quality: 0.85 } as const;

/** Debounce window before a typed change is autosaved (blur still saves instantly). */
const AUTOSAVE_DEBOUNCE_MS = 1200;

type SaveState = "idle" | "saving" | "saved" | "error" | "unsaved";

/** sessionStorage marker so we can explain (after a refresh) that failed File
 *  objects can't be recovered and must be reselected. Never stores file data. */
function failedMarkerKey(caseId: string): string {
  return `hairaudit:surgery-upload-failed:${caseId}`;
}
function setFailedMarker(caseId: string, count: number): void {
  try {
    sessionStorage.setItem(failedMarkerKey(caseId), JSON.stringify({ count, at: Date.now() }));
  } catch {
    // best-effort
  }
}
function clearFailedMarker(caseId: string): void {
  try {
    sessionStorage.removeItem(failedMarkerKey(caseId));
  } catch {
    // best-effort
  }
}
function hasFailedMarker(caseId: string): boolean {
  try {
    return sessionStorage.getItem(failedMarkerKey(caseId)) !== null;
  } catch {
    return false;
  }
}

/** Per-slot upload status used to drive progress, success, error + retry UI. */
type SlotUploadState = {
  uploading: number;
  error: string | null;
  /** Failed File objects retained in memory so the user can retry without reselecting. */
  failed: File[];
  success: boolean;
};

const EMPTY_SLOT_STATE: SlotUploadState = {
  uploading: 0,
  error: null,
  failed: [],
  success: false,
};

export default function SurgeryUploadFlowClient({
  caseId,
  userId,
  initialDetails,
  initialUploads,
  initialSlotReviews = [],
  evidenceEvents = [],
  auditIntakeStatus = null,
}: {
  caseId: string;
  userId?: string | null;
  initialDetails: SurgeryUploadDetails;
  initialUploads: SurgeryUploadRow[];
  initialSlotReviews?: SurgerySlotReviewRow[];
  evidenceEvents?: EvidenceTimelineEvent[];
  auditIntakeStatus?: AuditIntakeStatus | null;
}) {
  const router = useRouter();
  const [details, setDetails] = useState<SurgeryUploadDetails>(initialDetails);
  const [uploads, setUploads] = useState<SurgeryUploadRow[]>(initialUploads);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [slotState, setSlotState] = useState<Record<string, SlotUploadState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    upload: SurgeryUploadRow;
    label: string;
    position: number;
    count: number;
  } | null>(null);

  // ---- Stage 4B reliability state -------------------------------------------
  const [recovery, setRecovery] = useState<{
    draft: LocalSurgeryDraft;
    serverIsNewer: boolean;
  } | null>(null);
  const [online, setOnline] = useState(true);
  const [connectionRestored, setConnectionRestored] = useState(false);
  const [refreshedWithFailures, setRefreshedWithFailures] = useState(false);

  const locked = details.status === "submitted";
  // Stage 5: a reviewer can re-open a submitted upload for additional photos only.
  const needsMoreEvidence =
    locked && details.evidence_review_status === "needs_more_evidence";
  const uploadsAllowed = !locked || needsMoreEvidence;

  // Stage 5 resubmission state (clinic/doctor after adding requested evidence).
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitted, setResubmitted] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const slotReviewMap = useMemo(() => {
    const map: Record<string, SurgerySlotReviewRow> = {};
    for (const r of initialSlotReviews) map[r.slot_key] = r;
    return map;
  }, [initialSlotReviews]);

  // Source-of-truth refs (avoid stale closures inside async autosave).
  const detailsRef = useRef<SurgeryUploadDetails>(initialDetails);
  const serverValuesRef = useRef(pickRecoverableValues(initialDetails as Record<string, unknown>));
  const lastServerUpdatedRef = useRef<string | null>(initialDetails.updated_at ?? null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  /** Serializes overlapping flushSave calls (submit vs debounce vs blur). */
  const flushMutexRef = useRef<Promise<void> | null>(null);

  // Resolve THIS case's checklist snapshot (null => base HairAudit checklist).
  const resolved = useMemo(
    () => getResolvedSurgeryChecklist(details.photo_checklist_config),
    [details.photo_checklist_config]
  );
  const requiredSlots = useMemo(() => resolved.filter((s) => s.effectiveRequired), [resolved]);
  const optionalSlots = useMemo(
    () => resolved.filter((s) => s.state === "optional"),
    [resolved]
  );

  const uploadsBySlot = useMemo(() => {
    const map: Record<string, SurgeryUploadRow[]> = {};
    for (const u of uploads) {
      const slot = slotFromSurgeryType(u.type);
      if (!slot) continue;
      (map[slot] ||= []).push(u);
    }
    return map;
  }, [uploads]);

  const surgeryPhotoCount = useMemo(
    () => uploads.filter((u) => slotFromSurgeryType(u.type) !== null).length,
    [uploads]
  );

  const completion = useMemo(
    () => getRequiredPhotoCompletion(uploads, details.photo_checklist_config),
    [uploads, details.photo_checklist_config]
  );
  const requiredTotal = completion.total;
  const requiredDone = completion.done;
  const anyUploading = useMemo(
    () => Object.values(slotState).some((s) => s.uploading > 0),
    [slotState]
  );
  const canSubmit = !locked && completion.missing.length === 0 && !anyUploading;

  // Count-aware requirement messages ("Pre-op donor requires 2 photos; currently has 1.").
  const requirementMessages = useMemo(
    () => completion.failures.map((f) => f.message),
    [completion.failures]
  );
  const missingRequiredLabels = useMemo(
    () => completion.failures.map((f) => `${f.label} (${f.current}/${f.required})`),
    [completion.failures]
  );

  const openPreview = useCallback(
    (slotLabel: string, slotUploads: SurgeryUploadRow[], index: number) => {
      setPreview({
        upload: slotUploads[index],
        label: slotLabel,
        position: index + 1,
        count: slotUploads.length,
      });
    },
    []
  );

  // ---- Details autosave + local recovery -------------------------------------
  // Persist the minimal local diff (changed editable fields only) so a refresh /
  // lock / crash before server confirmation never loses typed details.
  const persistLocalDraft = useCallback(
    (next: SurgeryUploadDetails) => {
      if (next.status === "submitted") return;
      const patch = diffRecoverableValues(
        pickRecoverableValues(next as Record<string, unknown>),
        serverValuesRef.current
      );
      if (Object.keys(patch).length === 0) {
        clearLocalSurgeryDraft(caseId, userId);
      } else {
        saveLocalSurgeryDraft(caseId, patch, userId, lastServerUpdatedRef.current);
      }
    },
    [caseId, userId]
  );

  // The authoritative save: PATCH only fields that differ from the server, looping
  // until fully synced (user may type during a request). Returns true only when there
  // is nothing left to save or the case is read-only; false on network/server failure.
  const flushSave = useCallback(async (): Promise<boolean> => {
    if (locked) return true;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const prevMutex = flushMutexRef.current;
    let release!: () => void;
    const myTurn = new Promise<void>((r) => {
      release = r;
    });
    flushMutexRef.current = myTurn;
    try {
      await (prevMutex ?? Promise.resolve());
    } catch {
      // prior flush failed — still proceed
    }

    try {
      while (true) {
        const patch = diffRecoverableValues(
          pickRecoverableValues(detailsRef.current as Record<string, unknown>),
          serverValuesRef.current
        );
        if (Object.keys(patch).length === 0) {
          clearLocalSurgeryDraft(caseId, userId);
          setSaveState((s) => (s === "saved" ? "saved" : "idle"));
          return true;
        }

        savingRef.current = true;
        setSaveState("saving");
        try {
          const res = await fetch(`/api/surgery-upload/cases/${caseId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error ?? "Could not save");

          serverValuesRef.current = { ...serverValuesRef.current, ...patch };
          const updatedAt = (json?.details?.updated_at as string | undefined) ?? null;
          if (updatedAt) lastServerUpdatedRef.current = updatedAt;

          const remaining = diffRecoverableValues(
            pickRecoverableValues(detailsRef.current as Record<string, unknown>),
            serverValuesRef.current
          );
          if (Object.keys(remaining).length === 0) {
            clearLocalSurgeryDraft(caseId, userId);
            setSaveState("saved");
            setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
            return true;
          }
          saveLocalSurgeryDraft(caseId, remaining, userId, lastServerUpdatedRef.current);
          setSaveState("unsaved");
          // Loop: another PATCH for edits that landed during the request.
        } catch {
          saveLocalSurgeryDraft(caseId, patch, userId, lastServerUpdatedRef.current);
          setSaveState("error");
          return false;
        } finally {
          savingRef.current = false;
        }
      }
    } finally {
      release();
      if (flushMutexRef.current === myTurn) flushMutexRef.current = null;
    }
  }, [caseId, userId, locked]);

  const scheduleDebouncedSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void flushSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [flushSave]);

  // Apply a user edit: update state + ref, cache locally, mark unsaved, debounce.
  const applyChange = useCallback(
    (patch: Partial<SurgeryUploadDetails>) => {
      if (locked) return;
      const next = { ...detailsRef.current, ...patch } as SurgeryUploadDetails;
      detailsRef.current = next;
      setDetails(next);
      persistLocalDraft(next);
      setSaveState((s) => (s === "saving" ? "saving" : "unsaved"));
      scheduleDebouncedSave();
    },
    [locked, persistLocalDraft, scheduleDebouncedSave]
  );

  const onText = (field: keyof SurgeryUploadDetails) => ({
    value: (details[field] as string | number | null) ?? "",
    disabled: locked,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      applyChange({ [field]: e.target.value } as Partial<SurgeryUploadDetails>),
    onBlur: () => void flushSave(),
  });

  const onBool = (field: "prp_used" | "exosomes_used", value: boolean) => {
    applyChange({ [field]: value } as Partial<SurgeryUploadDetails>);
    void flushSave();
  };

  const onSelectProcedure = (value: string) => {
    applyChange({
      procedure_type: (value || null) as SurgeryUploadDetails["procedure_type"],
    });
    void flushSave();
  };

  const onDate = (value: string) => {
    applyChange({ surgery_date: value || null });
    void flushSave();
  };

  const hasUnsavedLocal = saveState === "unsaved" || saveState === "error";

  // ---- Photo upload (compress -> upload -> per-slot status + retry) ----------
  const uploadFiles = useCallback(
    async (slot: SurgeryPhotoSlotKey, files: File[], isRetry = false) => {
      if (!uploadsAllowed || files.length === 0) return;

      setSlotState((m) => {
        const prev = m[slot] ?? EMPTY_SLOT_STATE;
        return {
          ...m,
          [slot]: {
            ...prev,
            uploading: prev.uploading + files.length,
            error: null,
            success: false,
            // Retrying replaces the previous failed set; a fresh add keeps it.
            failed: isRetry ? [] : prev.failed,
          },
        };
      });

      const newFailures: File[] = [];
      let succeeded = 0;

      for (const original of files) {
        try {
          await uploadQueue.execute(async () => {
            const { file, meta } = await prepareImageForUpload(original, COMPRESS_OPTS);
            const fd = new FormData();
            fd.append("caseId", caseId);
            fd.append("category", slot);
            fd.append("files[]", file);
            // Stage 3.1: best-effort image metadata + low-res quality signal.
            fd.append("originalFilename", meta.originalFilename);
            fd.append("originalSizeBytes", String(meta.originalSizeBytes));
            fd.append("compressedSizeBytes", String(meta.compressedSizeBytes));
            if (meta.width != null) fd.append("width", String(meta.width));
            if (meta.height != null) fd.append("height", String(meta.height));
            fd.append("compressionApplied", String(meta.compressionApplied));
            if (meta.qualityWarning) fd.append("qualityWarning", meta.qualityWarning);
            const res = await fetch(PHOTO_API, { method: "POST", body: fd });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(
                formatUploadErrorForUser({
                  code: json?.code ?? "UNKNOWN_ERROR",
                  message: json?.error ?? "Upload failed",
                  retryable: false,
                })
              );
            }
            if (json.saved?.length) {
              setUploads((prev) => [...json.saved, ...prev]);
            }
          });
          succeeded += 1;
        } catch {
          // Keep the ORIGINAL file (not the compressed copy) so retry is reliable.
          newFailures.push(original);
        }
      }

      setSlotState((m) => {
        const prev = m[slot] ?? EMPTY_SLOT_STATE;
        const failed = [...prev.failed, ...newFailures];
        return {
          ...m,
          [slot]: {
            uploading: Math.max(0, prev.uploading - files.length),
            failed,
            error:
              newFailures.length > 0
                ? `${newFailures.length} photo${newFailures.length === 1 ? "" : "s"} failed to upload.`
                : prev.error,
            success: succeeded > 0 ? true : prev.success,
          },
        };
      });
    },
    [caseId, uploadsAllowed]
  );

  const retrySlot = useCallback(
    (slot: SurgeryPhotoSlotKey) => {
      const failed = slotState[slot]?.failed ?? [];
      if (failed.length === 0) return;
      void uploadFiles(slot, failed, true);
    },
    [slotState, uploadFiles]
  );

  const onDeleted = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  }, []);

  // ---- Upload interruption (aggregate failures across slots) ------------------
  const totalFailed = useMemo(
    () => Object.values(slotState).reduce((sum, s) => sum + s.failed.length, 0),
    [slotState]
  );

  const retryAllFailed = useCallback(() => {
    setConnectionRestored(false);
    for (const [slot, s] of Object.entries(slotState)) {
      if (s.failed.length > 0) void uploadFiles(slot as SurgeryPhotoSlotKey, s.failed, true);
    }
  }, [slotState, uploadFiles]);

  const clearAllFailed = useCallback(() => {
    setSlotState((m) => {
      const next: Record<string, SlotUploadState> = {};
      for (const [slot, s] of Object.entries(m)) {
        next[slot] = { ...s, failed: [], error: null };
      }
      return next;
    });
    clearFailedMarker(caseId);
    setRefreshedWithFailures(false);
  }, [caseId]);

  // Persist a lightweight "had failures" marker (no file data) so we can explain,
  // after a refresh, that File objects must be reselected. Cleared when resolved.
  const prevFailedRef = useRef(0);
  useEffect(() => {
    if (locked) return;
    if (totalFailed > 0) {
      setFailedMarker(caseId, totalFailed);
    } else if (prevFailedRef.current > 0) {
      clearFailedMarker(caseId);
      setRefreshedWithFailures(false);
    }
    prevFailedRef.current = totalFailed;
  }, [totalFailed, caseId, locked]);

  // ---- Mount: local recovery + prior-failure marker --------------------------
  useEffect(() => {
    if (locked) {
      clearLocalSurgeryDraft(caseId, userId);
      clearFailedMarker(caseId);
      return;
    }
    // Prior failed uploads existed but File objects can't survive a refresh.
    if (hasFailedMarker(caseId)) setRefreshedWithFailures(true);

    const draft = loadLocalSurgeryDraft(caseId, userId);
    if (!draft) return;
    const serverVals = pickRecoverableValues(initialDetails as Record<string, unknown>);
    if (!hasMeaningfulLocalDifferences(draft.values, serverVals)) {
      clearLocalSurgeryDraft(caseId, userId);
      return;
    }
    const serverIsNewer =
      !!draft.lastServerUpdatedAt &&
      !!initialDetails.updated_at &&
      new Date(initialDetails.updated_at).getTime() >
        new Date(draft.lastServerUpdatedAt).getTime();
    setRecovery({ draft, serverIsNewer });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Connection awareness --------------------------------------------------
  useEffect(() => {
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    function goOnline() {
      setOnline(true);
      setConnectionRestored(true);
    }
    function goOffline() {
      setOnline(false);
      setConnectionRestored(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ---- Recovery banner actions ----------------------------------------------
  const restoreLocal = useCallback(() => {
    if (!recovery) return;
    const next = { ...detailsRef.current, ...recovery.draft.values } as SurgeryUploadDetails;
    detailsRef.current = next;
    setDetails(next);
    setRecovery(null);
    setSaveState("unsaved");
    persistLocalDraft(next);
    void flushSave();
  }, [recovery, persistLocalDraft, flushSave]);

  const keepServer = useCallback(() => {
    clearLocalSurgeryDraft(caseId, userId);
    setRecovery(null);
  }, [caseId, userId]);

  // ---- Stage 5: resubmit additional evidence --------------------------------
  const resubmit = useCallback(async () => {
    if (resubmitting) return;
    setResubmitError(null);
    setResubmitting(true);
    try {
      const res = await fetch(`/api/surgery-upload/cases/${caseId}/resubmit-evidence`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Could not resubmit");
      }
      const next = {
        ...detailsRef.current,
        evidence_review_status: "in_review" as string,
      } as SurgeryUploadDetails;
      detailsRef.current = next;
      setDetails(next);
      setResubmitted(true);
      router.refresh();
    } catch (e) {
      setResubmitError((e as Error)?.message ?? "Could not resubmit");
    } finally {
      setResubmitting(false);
    }
  }, [caseId, resubmitting, router]);

  // ---- Submit ----------------------------------------------------------------
  const submit = useCallback(async () => {
    if (submitting) return;
    if (anyUploading) {
      setSubmitError("Please wait for all uploads to finish before submitting.");
      return;
    }
    if (!canSubmit) return;
    setSubmitError(null);

    // Save any unsaved local changes first so the submitted record is complete.
    if (hasUnsavedLocal || savingRef.current) {
      const saved = await flushSave();
      if (!saved) {
        setSubmitError(
          "Couldn't save your latest changes. Tap “Retry save”, then submit."
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/surgery-upload/cases/${caseId}/submit`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.requirementMessages?.length) {
          throw new Error(json.requirementMessages.join(" "));
        }
        if (json?.missingRequiredLabels?.length) {
          throw new Error(`Missing required photos: ${json.missingRequiredLabels.join(", ")}`);
        }
        if (json?.missingRequiredSlots?.length) {
          throw new Error("Some required photos are still missing.");
        }
        throw new Error(json?.error ?? "Could not submit");
      }
      // Submitted: clear all local recovery + failure state, lock read-only.
      clearLocalSurgeryDraft(caseId, userId);
      clearFailedMarker(caseId);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveState("idle");
      const next = {
        ...detailsRef.current,
        status: "submitted" as const,
        submitted_at: (json?.details?.submitted_at as string) ?? new Date().toISOString(),
      };
      detailsRef.current = next;
      setDetails(next);
      router.refresh();
    } catch (e) {
      setSubmitError((e as Error)?.message ?? "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    submitting,
    anyUploading,
    hasUnsavedLocal,
    flushSave,
    caseId,
    userId,
    router,
  ]);

  // ---- Leave-page protection (browser tab close / reload) --------------------
  const needsLeaveWarning =
    !locked && (anyUploading || saveState === "saving" || hasUnsavedLocal);
  useEffect(() => {
    if (!needsLeaveWarning) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Legacy requirement for the native confirmation dialog to appear.
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [needsLeaveWarning]);

  // Flush any pending debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (locked && !needsMoreEvidence) {
    return (
      <SubmittedConfirmation
        caseId={caseId}
        details={details}
        surgeryPhotoCount={surgeryPhotoCount}
        evidenceEvents={evidenceEvents}
        auditIntakeStatus={auditIntakeStatus}
      />
    );
  }

  if (locked && needsMoreEvidence) {
    const flaggedSlots = resolved
      .map((s) => ({ slot: s, review: slotReviewMap[s.key] }))
      .filter(
        (x) =>
          x.review &&
          (x.review.status === "needs_more_photos" || x.review.status === "poor_quality")
      );
    const canResubmit = completion.missing.length === 0 && !anyUploading && !resubmitting;
    return (
      <div className="mt-3 space-y-6 pb-28">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Additional evidence requested</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {evidenceReviewStatusLabel(details.evidence_review_status)}
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Submitted (locked details)
            </span>
          </div>
        </header>

        {/* Reviewer's request message */}
        {details.evidence_request_message && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">A reviewer has requested more evidence:</p>
            <p className="mt-1 text-sm text-amber-900">{details.evidence_request_message}</p>
          </div>
        )}

        <Banner tone="amber">
          Your surgical details are locked. You can add the requested photos below, then resubmit
          for review. Existing submitted photos cannot be deleted.
        </Banner>

        {/* Connection awareness */}
        {!online ? (
          <Banner tone="amber">
            You appear to be offline. Photos cannot upload until the connection returns.
          </Banner>
        ) : connectionRestored ? (
          <Banner tone="emerald" onDismiss={() => setConnectionRestored(false)}>
            Connection restored.{totalFailed > 0 ? " Please retry any failed uploads." : ""}
          </Banner>
        ) : null}

        {/* Slots the reviewer specifically flagged */}
        {flaggedSlots.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-700">Slots needing attention</p>
            <ul className="mt-2 space-y-1 text-sm">
              {flaggedSlots.map(({ slot, review }) => (
                <li key={slot.key} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{slot.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      review!.status === "poor_quality"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {slotReviewStatusLabel(review!.status)}
                  </span>
                  {review!.reviewer_notes && (
                    <span className="text-xs text-slate-500">— {review!.reviewer_notes}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stage 6A: read-only evidence-review activity so the clinic/doctor can see
            what was requested, what they resubmitted, and the reviewer's decisions. */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <SurgeryUploadEvidenceTimeline
            events={evidenceEvents}
            title="Evidence review activity"
            subtitle="What the reviewer has requested and your recent submissions."
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Photo export</p>
          <div className="mt-2">
            <SurgeryPhotoExportPackButton caseId={caseId} surgeryPhotoCount={surgeryPhotoCount} />
          </div>
        </div>

        {/* Aggregate upload-failure banner */}
        {totalFailed > 0 && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">Some photos failed to upload.</p>
            <p className="mt-0.5 text-xs text-red-700">
              {totalFailed} file{totalFailed === 1 ? "" : "s"} still selected on this device — retry without
              choosing them again.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={retryAllFailed}
                disabled={anyUploading || !online}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
              >
                Retry failed uploads
              </button>
              <button
                type="button"
                onClick={clearAllFailed}
                className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 active:scale-[0.99]"
              >
                Clear failed upload list
              </button>
            </div>
          </div>
        )}

        {/* Photo slots — upload allowed, deletion blocked */}
        <Section title="Required photos" subtitle="Add any additional photos requested above.">
          <div className="space-y-3">
            {requiredSlots.map((slot) => (
              <PhotoSlotCard
                key={slot.key}
                slot={slot}
                existing={uploadsBySlot[slot.key] ?? []}
                state={slotState[slot.key] ?? EMPTY_SLOT_STATE}
                canUpload
                canDelete={false}
                onUpload={(files) => uploadFiles(slot.key, files)}
                onRetry={() => retrySlot(slot.key)}
                onDeleted={onDeleted}
                onPreview={(i) => openPreview(slot.label, uploadsBySlot[slot.key] ?? [], i)}
              />
            ))}
          </div>
        </Section>
        {optionalSlots.length > 0 && (
          <Section title="Optional photos" subtitle="Add any that apply.">
            <div className="space-y-3">
              {optionalSlots.map((slot) => (
                <PhotoSlotCard
                  key={slot.key}
                  slot={slot}
                  existing={uploadsBySlot[slot.key] ?? []}
                  state={slotState[slot.key] ?? EMPTY_SLOT_STATE}
                  canUpload
                  canDelete={false}
                  onUpload={(files) => uploadFiles(slot.key, files)}
                  onRetry={() => retrySlot(slot.key)}
                  onDeleted={onDeleted}
                  onPreview={(i) => openPreview(slot.label, uploadsBySlot[slot.key] ?? [], i)}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Resubmit bar */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1 text-xs text-slate-500">
              {resubmitted ? (
                <span className="font-medium text-emerald-700">
                  Additional evidence submitted for review.
                </span>
              ) : anyUploading ? (
                <span>Please wait for uploads to finish.</span>
              ) : canResubmit ? (
                <span className="font-medium text-emerald-700">Ready to resubmit</span>
              ) : (
                <span>
                  {completion.missing.length} required photo
                  {completion.missing.length === 1 ? "" : "s"} still missing
                </span>
              )}
              {resubmitError && <p className="text-red-600">{resubmitError}</p>}
            </div>
            <button
              type="button"
              onClick={resubmit}
              disabled={!canResubmit || resubmitted}
              className={`shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-white transition ${
                canResubmit && !resubmitted
                  ? "bg-cyan-600 active:scale-[0.99]"
                  : "cursor-not-allowed bg-slate-300"
              }`}
            >
              {resubmitting ? "Submitting…" : "Resubmit additional evidence"}
            </button>
          </div>
        </div>

        {preview && (
          <ImageLightbox
            upload={preview.upload as LightboxUpload}
            label={preview.label}
            position={preview.position}
            count={preview.count}
            onClose={() => setPreview(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Surgery upload</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            Draft
          </span>
          {details.prefilled_from_clinic_defaults && (
            <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-800">
              Using clinic defaults
            </span>
          )}
          <SaveIndicator state={saveState} />
          {(saveState === "unsaved" || saveState === "error") && (
            <button
              type="button"
              onClick={() => void flushSave()}
              className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white active:scale-[0.99]"
            >
              {saveState === "error" ? "Retry save" : "Save now"}
            </button>
          )}
        </div>
      </header>

      {/* In-session reminder for accidental back navigation (browser still uses beforeunload). */}
      {needsLeaveWarning && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          You have work in progress on this page. Save or finish uploads before leaving — your browser
          may warn you if you close or reload the tab.
        </p>
      )}

      {/* Local draft recovery banner */}
      {recovery && (
        <RecoveryBanner
          savedAt={recovery.draft.savedAt}
          serverIsNewer={recovery.serverIsNewer}
          onRestore={restoreLocal}
          onKeepServer={keepServer}
        />
      )}

      {/* Connection awareness */}
      {!online ? (
        <Banner tone="amber">
          You appear to be offline. Photos cannot upload until the connection returns.
          Your typed details are saved on this device.
        </Banner>
      ) : connectionRestored ? (
        <Banner tone="emerald" onDismiss={() => setConnectionRestored(false)}>
          Connection restored.{totalFailed > 0 ? " Please retry any failed uploads." : ""}
        </Banner>
      ) : null}

      {/* Progress */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">Required photos</span>
          <span className="font-semibold text-slate-900">
            {requiredDone} / {requiredTotal}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-cyan-500 transition-all"
            style={{ width: `${requiredTotal ? (requiredDone / requiredTotal) * 100 : 0}%` }}
          />
        </div>
        {completion.missing.length === 0 ? (
          <p className="mt-2 text-xs font-semibold text-emerald-700">
            Required photos complete ✓
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            {completion.missing.length} required photo
            {completion.missing.length === 1 ? "" : "s"} remaining
          </p>
        )}
      </div>

      {/* Section 1: case basics */}
      <Section title="Case details" subtitle="Who and what this surgery was for.">
        <Field label="Patient / case reference">
          <input className={inputCls} placeholder="e.g. HT-1042 or initials" {...onText("patient_reference")} />
        </Field>
        <Field label="Clinic">
          <input className={inputCls} placeholder="Clinic name" {...onText("clinic_name")} />
        </Field>
        <Field label="Doctor / surgeon">
          <input className={inputCls} placeholder="Surgeon name" {...onText("surgeon_name")} />
        </Field>
        <Field label="Surgery date">
          <input
            type="date"
            className={inputCls}
            value={details.surgery_date ?? ""}
            disabled={locked}
            onChange={(e) => onDate(e.target.value)}
          />
        </Field>
        <Field label="Procedure type">
          <select
            className={inputCls}
            value={details.procedure_type ?? ""}
            disabled={locked}
            onChange={(e) => onSelectProcedure(e.target.value)}
          >
            <option value="">Select…</option>
            {SURGERY_PROCEDURE_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <textarea className={textareaCls} rows={3} placeholder="General notes" {...onText("notes")} />
        </Field>
      </Section>

      {/* Section 2: surgery preferences/details */}
      <Section
        title="Surgery details"
        subtitle="Equipment and intra-operative details. Change for this case only — clinic defaults are unaffected."
      >
        {details.prefilled_from_clinic_defaults && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-cyan-800">
            <p className="text-sm font-semibold">Using clinic defaults</p>
            <p className="mt-0.5 text-xs">
              These values were copied from the clinic&apos;s saved preferences. Changes
              here apply to this surgery only.
            </p>
          </div>
        )}
        <Field label="Extraction machine used">
          <input className={inputCls} placeholder="e.g. WAW, Devroye, manual" {...onText("extraction_machine")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Punch size">
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder="e.g. 0.8, 0.9, 1.0"
              {...onText("punch_size")}
            />
          </Field>
          <Field label="Punch type / brand">
            <input className={inputCls} placeholder="Optional" {...onText("punch_type")} />
          </Field>
        </div>
        <Field label="Implantation method / device">
          <input className={inputCls} placeholder="e.g. implanter pens, forceps" {...onText("implantation_method")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <ToggleField
            label="PRP used intra-op"
            value={details.prp_used}
            disabled={locked}
            onChange={(v) => onBool("prp_used", v)}
          />
          <ToggleField
            label="Exosomes used"
            value={details.exosomes_used}
            disabled={locked}
            onChange={(v) => onBool("exosomes_used", v)}
          />
        </div>
        <Field label="ATP / HypoThermosol / storage solution">
          <input className={inputCls} placeholder="Storage solution used" {...onText("storage_solution")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Planned grafts">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputCls}
              {...onText("planned_grafts")}
            />
          </Field>
          <Field label="Actual grafts">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputCls}
              {...onText("actual_grafts")}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Extraction start">
            <input type="time" className={inputCls} {...onText("extraction_start_time")} />
          </Field>
          <Field label="Implantation start">
            <input type="time" className={inputCls} {...onText("implantation_start_time")} />
          </Field>
          <Field label="Finish">
            <input type="time" className={inputCls} {...onText("surgery_finish_time")} />
          </Field>
        </div>
        <Field label="Notes / complications">
          <textarea
            className={textareaCls}
            rows={3}
            placeholder="Optional"
            {...onText("complication_notes")}
          />
        </Field>
      </Section>

      {/* Photo upload guidance */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <p>📷 Large images are automatically compressed before upload.</p>
        <p className="mt-1">
          Use clear, well-lit photos. Avoid blurry or obstructed images.
        </p>
      </div>

      {/* Aggregate upload-failure banner */}
      {totalFailed > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Some photos failed to upload.</p>
          <p className="mt-0.5 text-xs text-red-700">
            {totalFailed} file{totalFailed === 1 ? "" : "s"} still selected on this device — you can retry
            without choosing them again.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retryAllFailed}
              disabled={anyUploading || !online}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
            >
              Retry failed uploads
            </button>
            <button
              type="button"
              onClick={clearAllFailed}
              className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 active:scale-[0.99]"
            >
              Clear failed upload list
            </button>
          </div>
        </div>
      )}

      {/* Refresh limitation copy (failures existed before a reload) */}
      {refreshedWithFailures && totalFailed === 0 && (
        <Banner tone="amber" onDismiss={() => { clearFailedMarker(caseId); setRefreshedWithFailures(false); }}>
          For privacy and browser security, photos must be selected again after a refresh.
          Previously failed photos were not kept.
        </Banner>
      )}

      {/* Section 3: required photos */}
      <Section
        title="Required photos"
        subtitle={`All ${requiredTotal} are needed before you can submit.`}
      >
        <div className="space-y-3">
          {requiredSlots.map((slot) => (
            <PhotoSlotCard
              key={slot.key}
              slot={slot}
              existing={uploadsBySlot[slot.key] ?? []}
              state={slotState[slot.key] ?? EMPTY_SLOT_STATE}
              canUpload={!locked}
              canDelete={!locked}
              onUpload={(files) => uploadFiles(slot.key, files)}
              onRetry={() => retrySlot(slot.key)}
              onDeleted={onDeleted}
              onPreview={(i) => openPreview(slot.label, uploadsBySlot[slot.key] ?? [], i)}
            />
          ))}
        </div>
      </Section>

      {/* Section 4: optional photos (hidden slots are intentionally omitted) */}
      {optionalSlots.length > 0 && (
        <Section title="Optional photos" subtitle="Add any that apply.">
          <div className="space-y-3">
            {optionalSlots.map((slot) => (
              <PhotoSlotCard
                key={slot.key}
                slot={slot}
                existing={uploadsBySlot[slot.key] ?? []}
                state={slotState[slot.key] ?? EMPTY_SLOT_STATE}
                canUpload={!locked}
                canDelete={!locked}
                onUpload={(files) => uploadFiles(slot.key, files)}
                onRetry={() => retrySlot(slot.key)}
                onDeleted={onDeleted}
                onPreview={(i) => openPreview(slot.label, uploadsBySlot[slot.key] ?? [], i)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Missing-requirements summary (above the submit bar) */}
      {requirementMessages.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Before you can submit:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
            {requirementMessages.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs text-slate-500">
            {anyUploading ? (
              <span>Please wait for uploads to finish before submitting.</span>
            ) : canSubmit ? (
              hasUnsavedLocal ? (
                <span>Ready to submit — your changes will be saved first.</span>
              ) : (
                <span className="font-medium text-emerald-700">Ready to submit</span>
              )
            ) : missingRequiredLabels.length > 0 ? (
              <span>Missing: {missingRequiredLabels.join(", ")}</span>
            ) : (
              <span>{completion.missing.length} required photo(s) remaining</span>
            )}
            {submitError && <p className="text-red-600">{submitError}</p>}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || submitting}
            className={`shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-white transition ${
              canSubmit && !submitting
                ? "bg-cyan-600 active:scale-[0.99]"
                : "cursor-not-allowed bg-slate-300"
            }`}
          >
            {submitting ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      </div>

      {preview && (
        <ImageLightbox
          upload={preview.upload as LightboxUpload}
          label={preview.label}
          position={preview.position}
          count={preview.count}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500";
const textareaCls = `${inputCls} resize-y`;

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean | null;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex overflow-hidden rounded-xl border border-slate-300">
        {[
          { v: true, label: "Yes" },
          { v: false, label: "No" },
        ].map((opt) => {
          const active = value === opt.v;
          return (
            <button
              key={opt.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.v)}
              className={`flex-1 px-3 py-3 text-sm font-semibold transition ${
                active ? "bg-cyan-600 text-white" : "bg-white text-slate-600"
              } disabled:opacity-60`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving")
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        Saving…
      </span>
    );
  if (state === "saved")
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
        Saved
      </span>
    );
  if (state === "unsaved")
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
        Unsaved local changes
      </span>
    );
  if (state === "error")
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
        Save failed — your changes are stored on this device
      </span>
    );
  return null;
}

function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: "amber" | "emerald" | "red";
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const toneCls =
    tone === "amber"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : tone === "emerald"
        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
        : "border-red-300 bg-red-50 text-red-900";
  return (
    <div className={`flex items-start justify-between gap-3 rounded-2xl border p-4 ${toneCls}`}>
      <p className="text-sm">{children}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

function RecoveryBanner({
  savedAt,
  serverIsNewer,
  onRestore,
  onKeepServer,
}: {
  savedAt: string;
  serverIsNewer: boolean;
  onRestore: () => void;
  onKeepServer: () => void;
}) {
  const when = (() => {
    try {
      const d = new Date(savedAt);
      if (Number.isNaN(d.getTime())) return savedAt;
      return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    } catch {
      return savedAt;
    }
  })();
  return (
    <div className="rounded-2xl border border-cyan-300 bg-cyan-50 p-4">
      <p className="text-sm font-semibold text-cyan-900">
        Unsaved local changes were found from this device.
      </p>
      <p className="mt-0.5 text-xs text-cyan-800">Local changes saved on this device at {when}.</p>
      {serverIsNewer && (
        <p className="mt-1 text-xs font-medium text-amber-800">
          Note: this case was also updated elsewhere since then. Keeping the server version is safer
          unless you know your local changes are newer.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRestore}
          className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white active:scale-[0.99]"
        >
          Restore local changes
        </button>
        <button
          type="button"
          onClick={onKeepServer}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 active:scale-[0.99]"
        >
          Keep server version
        </button>
      </div>
    </div>
  );
}

function PhotoSlotCard({
  slot,
  existing,
  state,
  canUpload,
  canDelete,
  onUpload,
  onRetry,
  onDeleted,
  onPreview,
}: {
  slot: ResolvedSurgerySlot;
  existing: SurgeryUploadRow[];
  state: SlotUploadState;
  canUpload: boolean;
  canDelete: boolean;
  onUpload: (files: File[]) => void;
  onRetry: () => void;
  onDeleted: (id: string) => void;
  onPreview: (index: number) => void;
}) {
  const remaining = Math.max(0, slot.maxFiles - existing.length);
  const busy = state.uploading > 0;
  // Disable inputs while uploading to prevent double-tap duplicate uploads.
  const disabled = !canUpload || remaining <= 0 || busy;
  const count = existing.length;
  // Stage 3.1: a required slot is only "complete" once it meets its minCount.
  const required = slot.requiredCount;
  const requirementMet = slot.effectiveRequired ? count >= required : count > 0;
  const incomplete = slot.effectiveRequired && count < required;
  const hasFailures = state.failed.length > 0;
  const justSucceeded = !busy && !hasFailures && state.success;

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    if (files.length) onUpload(files);
    e.target.value = "";
  }

  return (
    <div
      className={`rounded-xl border p-3 ${
        incomplete ? "border-amber-300 bg-amber-50/40" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">
            {slot.label}
            {slot.effectiveRequired ? (
              <span className="ml-1 text-xs text-amber-700">(required)</span>
            ) : (
              <span className="ml-1 text-xs text-slate-400">(optional)</span>
            )}
          </p>
          <p className="text-xs text-slate-500">{slot.help}</p>
          {slot.effectiveRequired && (
            <p
              className={`mt-0.5 text-xs font-semibold ${
                requirementMet ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {count}/{required} required{requirementMet ? " ✓" : ""}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            busy
              ? "bg-cyan-100 text-cyan-800"
              : requirementMet && count > 0
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {busy
            ? "Uploading…"
            : slot.effectiveRequired
              ? `${count}/${required}${requirementMet ? " ✓" : ""}`
              : count > 0
                ? `${count} ✓`
                : "0"}
        </span>
      </div>

      {justSucceeded && (
        <p className="mt-2 text-xs font-medium text-emerald-700">Uploaded ✓</p>
      )}

      {state.error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2">
          <p className="text-xs text-red-700">{state.error}</p>
          {hasFailures && !busy && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white active:scale-[0.99]"
            >
              Retry {state.failed.length} failed
            </button>
          )}
        </div>
      )}

      {existing.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {existing.map((u, i) => (
            <UploadedThumb
              key={u.id}
              upload={u}
              locked={!canDelete}
              onDeleted={() => onDeleted(u.id)}
              onPreview={() => onPreview(i)}
            />
          ))}
        </div>
      )}

      {canUpload && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* Camera capture (mobile) */}
          <label
            className={`flex items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm font-semibold text-cyan-800 ${
              disabled ? "opacity-60" : "active:scale-[0.99]"
            }`}
          >
            {busy ? "Uploading…" : "Take photo"}
            <input
              type="file"
              accept={slot.accept}
              capture="environment"
              className="hidden"
              disabled={disabled}
              onChange={handleInput}
            />
          </label>
          {/* Gallery / multiple */}
          <label
            className={`flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 ${
              disabled ? "opacity-60" : "active:scale-[0.99]"
            }`}
          >
            Choose
            <input
              type="file"
              accept={slot.accept}
              multiple
              className="hidden"
              disabled={disabled}
              onChange={handleInput}
            />
          </label>
        </div>
      )}
      {remaining <= 0 && canUpload && (
        <p className="mt-2 text-xs text-slate-400">Maximum reached</p>
      )}
    </div>
  );
}

function SubmittedConfirmation({
  caseId,
  details,
  surgeryPhotoCount,
  evidenceEvents,
  auditIntakeStatus = null,
}: {
  caseId: string;
  details: SurgeryUploadDetails;
  surgeryPhotoCount: number;
  evidenceEvents: EvidenceTimelineEvent[];
  auditIntakeStatus?: AuditIntakeStatus | null;
}) {
  return (
    <div className="mt-6 space-y-6 pb-10">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
          ✓
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Submitted for review</h1>
        <p className="mt-1 text-sm text-slate-600">
          {details.patient_reference?.trim() || "This surgery upload"} has been submitted with{" "}
          {surgeryPhotoCount} surgery photo{surgeryPhotoCount === 1 ? "" : "s"}. It is now locked to preserve
          integrity.
        </p>
        {details.submitted_at && (
          <p className="mt-2 text-xs text-slate-400">
            Submitted {new Date(details.submitted_at).toLocaleString()}
          </p>
        )}
        {auditIntakeStatus && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800">
            Sent to audit intake · {auditIntakeStatusLabel(auditIntakeStatus)}
          </p>
        )}
        <Link
          href="/dashboard/surgery-upload"
          className="mt-5 inline-flex rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white"
        >
          Back to surgery uploads
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Photo export</p>
        <p className="mt-1 text-xs text-slate-500">
          Available while evidence is under review (submitted, needs more evidence, or accepted).
        </p>
        <div className="mt-2">
          <SurgeryPhotoExportPackButton caseId={caseId} surgeryPhotoCount={surgeryPhotoCount} />
        </div>
      </div>

      {/* Stage 6A: read-only evidence-review activity for the clinic/doctor. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <SurgeryUploadEvidenceTimeline
          events={evidenceEvents}
          title="Evidence review activity"
          subtitle="A read-only record of reviewer activity for this upload."
        />
      </div>
    </div>
  );
}
