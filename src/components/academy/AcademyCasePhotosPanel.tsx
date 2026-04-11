"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AcademyPhotoCategory } from "@/lib/academy/constants";
import { parseTrainingPhotoType } from "@/lib/academy/photoCategories";
import type { TrainingCaseUploadRow } from "@/lib/academy/types";
import {
  TRAINING_PHOTO_GROUPS,
  TRAINING_PHOTO_SLOTS_FLAT,
  type TrainingPhotoSlotDef,
} from "@/lib/academy/trainingCasePhotoUploadUi";
import AcademySignedThumb from "@/components/academy/AcademySignedThumb";
import { UploadQueue, UPLOAD_LIMITS } from "@/lib/uploads/safeUpload";

const PENDING_DRAG_TYPE = "application/academy-pending";

type PendingBulkItem = {
  id: string;
  file: File;
  previewUrl: string;
  category: AcademyPhotoCategory | "";
};

function useUploadsByCategory(uploads: TrainingCaseUploadRow[]) {
  return useMemo(() => {
    const m = new Map<AcademyPhotoCategory, TrainingCaseUploadRow[]>();
    for (const u of uploads) {
      const c = parseTrainingPhotoType(u.type);
      if (!c) continue;
      const arr = m.get(c) ?? [];
      arr.push(u);
      m.set(c, arr);
    }
    return m;
  }, [uploads]);
}

async function postOneFile(caseId: string, category: AcademyPhotoCategory, file: File) {
  const maxBytes = UPLOAD_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`Each image must be under ${UPLOAD_LIMITS.MAX_FILE_SIZE_MB}MB.`);
  }
  const fd = new FormData();
  fd.set("caseId", caseId);
  fd.set("category", category);
  fd.append("files[]", file);
  const res = await fetch("/api/academy/uploads", { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Upload failed");
  return j;
}

function slotLabel(slot: TrainingPhotoSlotDef): string {
  return slot.required ? slot.title : `${slot.title} · optional`;
}

function CategorySlot({
  caseId,
  slot,
  rows,
  isStaff,
  viewerUserId,
  onAfterChange,
}: {
  caseId: string;
  slot: TrainingPhotoSlotDef;
  rows: TrainingCaseUploadRow[];
  isStaff: boolean;
  viewerUserId: string;
  onAfterChange: () => void;
}) {
  const cat = slot.category;
  const baseId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const queueRef = useRef(new UploadQueue(UPLOAD_LIMITS.MAX_CONCURRENT_UPLOADS));

  const uploadMany = useCallback(
    async (files: File[]) => {
      const list = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(f.name));
      if (list.length === 0) {
        setStatus("No supported images in that drop.");
        return;
      }
      setBusy(true);
      setStatus(null);
      let ok = 0;
      let lastErr: string | null = null;
      try {
        await Promise.all(
          list.map((file) =>
            queueRef.current.execute(async () => {
              try {
                await postOneFile(caseId, cat, file);
                ok++;
              } catch (e) {
                lastErr = e instanceof Error ? e.message : "Upload failed";
              }
            })
          )
        );
        if (lastErr && ok === 0) setStatus(lastErr);
        else if (lastErr) setStatus(`Uploaded ${ok} · ${lastErr}`);
        else setStatus(`Uploaded ${ok} image${ok === 1 ? "" : "s"}`);
        onAfterChange();
      } finally {
        setBusy(false);
      }
    },
    [caseId, cat, onAfterChange]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    e.target.value = "";
    if (fl?.length) void uploadMany(Array.from(fl));
  };

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragDepth(0);
    const pendingId = e.dataTransfer.getData(PENDING_DRAG_TYPE);
    if (pendingId) {
      window.dispatchEvent(new CustomEvent("academy-pending-assign", { detail: { id: pendingId, category: cat } }));
      return;
    }
    if (e.dataTransfer.files?.length) void uploadMany(Array.from(e.dataTransfer.files));
  }

  return (
    <div
      className={`rounded-xl border transition-colors ${
        dragDepth > 0
          ? "border-amber-400/80 bg-amber-50/60 ring-2 ring-amber-400/30"
          : "border-slate-200/90 bg-white/80"
      }`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragDepth((d) => d + 1);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragDepth((d) => Math.max(0, d - 1));
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = [...e.dataTransfer.types].includes(PENDING_DRAG_TYPE) ? "move" : "copy";
      }}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">{slotLabel(slot)}</h4>
            {slot.required ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                Required
              </span>
            ) : null}
          </div>
          {slot.caption ? <p className="mt-0.5 text-xs text-slate-500">{slot.caption}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-amber-300 hover:text-amber-900 disabled:opacity-50 md:hidden"
          >
            Camera
          </button>
          <label
            htmlFor={`${baseId}-file`}
            className={`cursor-pointer rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-amber-500 hover:to-amber-600 ${busy ? "pointer-events-none opacity-50" : ""}`}
          >
            <input
              id={`${baseId}-file`}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={busy}
              onChange={onInputChange}
            />
            {busy ? "Uploading…" : "Add photos"}
          </label>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={busy}
            onChange={onInputChange}
          />
        </div>
      </div>

      <div className="px-3 py-3 sm:px-4 sm:py-4">
        <p className="mb-3 text-center text-xs text-slate-500">
          Drop files here, tap <span className="font-medium text-slate-700">Add photos</span>, or drag from bulk queue below.
        </p>
        {rows.length === 0 ? (
          <div className="flex min-h-[88px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 text-xs text-slate-500">
            {busy ? "Uploading…" : "No images yet"}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {rows.map((u) => (
              <li key={u.id}>
                <AcademySignedThumb
                  storagePath={u.storage_path}
                  label={slot.title}
                  uploadId={u.id}
                  canDelete={isStaff || u.uploaded_by === viewerUserId}
                  onDeleted={onAfterChange}
                />
              </li>
            ))}
          </ul>
        )}
        {status ? <p className="mt-2 text-center text-xs text-slate-600">{status}</p> : null}
      </div>
    </div>
  );
}

function PendingBulkCard({
  pending,
  onRemove,
  onCategoryChange,
}: {
  pending: PendingBulkItem;
  onRemove: (id: string) => void;
  onCategoryChange: (id: string, category: AcademyPhotoCategory | "") => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PENDING_DRAG_TYPE, pending.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="relative rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm touch-manipulation"
    >
      <button
        type="button"
        onClick={() => onRemove(pending.id)}
        className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-md hover:bg-slate-800"
        aria-label="Remove from queue"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pending.previewUrl} alt="" className="aspect-video w-full rounded-md object-cover bg-slate-100" />
      <select
        value={pending.category}
        onChange={(e) => {
          const v = e.target.value;
          onCategoryChange(pending.id, (v || "") as AcademyPhotoCategory | "");
        }}
        className="mt-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-[10px] font-medium text-slate-800"
        aria-label="Assign category"
      >
        <option value="">Assign category…</option>
        {TRAINING_PHOTO_SLOTS_FLAT.map((s) => (
          <option key={s.category} value={s.category}>
            {s.title}
            {s.required ? "" : " (opt.)"}
          </option>
        ))}
      </select>
      <p className="mt-1 text-center text-[10px] text-slate-400">Drag to a zone above</p>
    </div>
  );
}

export default function AcademyCasePhotosPanel({
  caseId,
  initialUploads,
  viewerUserId,
  isStaff,
}: {
  caseId: string;
  initialUploads: TrainingCaseUploadRow[];
  viewerUserId: string;
  isStaff: boolean;
}) {
  const router = useRouter();
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingBulkItem[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const bulkQueueRef = useRef(new UploadQueue(UPLOAD_LIMITS.MAX_CONCURRENT_UPLOADS));

  const byCat = useUploadsByCategory(initialUploads);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const setPendingCategory = useCallback((id: string, category: AcademyPhotoCategory | "") => {
    setPending((p) => p.map((x) => (x.id === id ? { ...x, category } : x)));
  }, []);

  const removePending = useCallback((id: string) => {
    setPending((p) => {
      const item = p.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return p.filter((x) => x.id !== id);
    });
  }, []);

  useEffect(() => {
    function onAssign(e: Event) {
      const ce = e as CustomEvent<{ id: string; category: AcademyPhotoCategory }>;
      if (ce.detail?.id && ce.detail.category) {
        setPending((p) => p.map((x) => (x.id === ce.detail.id ? { ...x, category: ce.detail.category } : x)));
      }
    }
    window.addEventListener("academy-pending-assign", onAssign);
    return () => window.removeEventListener("academy-pending-assign", onAssign);
  }, []);

  const addBulkFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(f.name));
    setBulkMsg(null);
    setPending((p) => {
      const next = [...p];
      for (const file of list) {
        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          category: "",
        });
      }
      return next;
    });
  };

  const uploadBulkQueue = async () => {
    const ready = pending.filter((x): x is PendingBulkItem & { category: AcademyPhotoCategory } => Boolean(x.category));
    if (ready.length === 0) {
      setBulkMsg("Assign a category to each photo (or drag a thumbnail into a zone).");
      return;
    }
    setBulkBusy(true);
    setBulkMsg(null);
    let ok = 0;
    let lastErr: string | null = null;
    const succeeded: PendingBulkItem[] = [];
    try {
      const outcomes = await Promise.all(
        ready.map((item) =>
          bulkQueueRef.current.execute(async () => {
            try {
              await postOneFile(caseId, item.category, item.file);
              return { item, ok: true as const };
            } catch (e) {
              lastErr = e instanceof Error ? e.message : "Upload failed";
              return { item, ok: false as const };
            }
          })
        )
      );
      for (const o of outcomes) {
        if (o.ok) {
          ok++;
          succeeded.push(o.item);
        }
      }
      if (lastErr && ok === 0) setBulkMsg(lastErr);
      else if (lastErr) setBulkMsg(`Saved ${ok} · ${lastErr}`);
      else setBulkMsg(`Saved ${ok} image${ok === 1 ? "" : "s"}`);
      const doneIds = new Set(succeeded.map((x) => x.id));
      for (const x of succeeded) URL.revokeObjectURL(x.previewUrl);
      setPending((p) => p.filter((x) => !doneIds.has(x.id)));
      if (ok > 0) refresh();
    } finally {
      setBulkBusy(false);
    }
  };

  const clearBulk = () => {
    setPending((p) => {
      for (const x of p) URL.revokeObjectURL(x.previewUrl);
      return [];
    });
    setBulkMsg(null);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 shadow-sm">
      <div className="border-b border-amber-500/25 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold tracking-tight text-white">Case media</h3>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
          Every category is on screen — drop a folder, use bulk add, or capture from the ward without hunting dropdowns.
        </p>
      </div>

      <div className="space-y-6 p-4 sm:p-5">
        {TRAINING_PHOTO_GROUPS.map((group) => (
          <section key={group.id} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200/80 pb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{group.title}</h3>
                <p className="mt-0.5 text-sm text-slate-700">{group.lead}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {group.slots.map((slot) => (
                <CategorySlot
                  key={slot.category}
                  caseId={caseId}
                  slot={slot}
                  rows={byCat.get(slot.category) ?? []}
                  viewerUserId={viewerUserId}
                  isStaff={isStaff}
                  onAfterChange={refresh}
                />
              ))}
            </div>
          </section>
        ))}

        <details className="group rounded-xl border border-dashed border-slate-300/90 bg-slate-50/50 p-3 sm:p-4 open:border-amber-200 open:bg-amber-50/20">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                Bulk
              </span>
              Add many files, then assign or drag into zones
            </span>
          </summary>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => bulkInputRef.current?.click()}
                disabled={bulkBusy}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-amber-400 disabled:opacity-50"
              >
                Choose images
              </button>
              <input
                ref={bulkInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={bulkBusy}
                onChange={(e) => {
                  addBulkFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={bulkBusy || pending.length === 0}
                onClick={() => void uploadBulkQueue()}
                className="rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:from-amber-500 hover:to-amber-600 disabled:opacity-50"
              >
                {bulkBusy ? "Uploading…" : "Upload assigned"}
              </button>
              {pending.length > 0 ? (
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={clearBulk}
                  className="text-xs font-semibold text-slate-600 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Clear queue
                </button>
              ) : null}
            </div>
            {bulkMsg ? <p className="text-xs text-slate-600">{bulkMsg}</p> : null}
            {pending.length > 0 ? (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {pending.map((item) => (
                  <li key={item.id}>
                    <PendingBulkCard pending={item} onRemove={removePending} onCategoryChange={setPendingCategory} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Tip: select a whole camera roll here, set categories, or drag each thumbnail into the right section above.</p>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
