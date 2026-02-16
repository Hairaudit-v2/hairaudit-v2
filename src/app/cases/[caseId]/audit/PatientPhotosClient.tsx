"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PATIENT_PHOTO_CATEGORIES,
  PatientPhotoCategory,
  resolveCategoryForValidation,
} from "@/lib/photoCategories";

const CATEGORIES = PATIENT_PHOTO_CATEGORIES.map((c) => ({
  key: c.key,
  label: c.title,
  required: c.required,
}));

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  created_at: string;
};

export default function PatientPhotosClient({ caseId }: { caseId: string }) {
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploads, setUploads] = useState<UploadRow[]>([]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  useEffect(() => {
    return () => {
      previews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previews]);

  async function refresh() {
    const res = await fetch(`/api/uploads/patient-photos?caseId=${caseId}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setUploads(data.uploads ?? []);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function uploadNow() {
    setMsg("");
    if (!files.length) {
      setMsg("Please choose at least one photo.");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);

      const res = await fetch(
        `/api/uploads/patient-photos?caseId=${caseId}&category=${encodeURIComponent(category)}`,
        { method: "POST", body: fd }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`Upload failed: ${data?.error ?? res.statusText}`);
      } else {
        setMsg(`Uploaded ✅ (${(data.uploaded ?? []).length} file(s))`);
        setFiles([]);
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function requiredCoverage() {
    const keysPresent = new Set<string>();
    for (const u of uploads) {
      const t = u.type || "";
      if (!t.startsWith("patient_photo:")) continue;
      const raw = t.replace("patient_photo:", "");
      for (const resolved of resolveCategoryForValidation(raw)) {
        keysPresent.add(resolved);
      }
    }
    const required = CATEGORIES.filter((c) => c.required).map((c) => c.key);
    const missing = required.filter((k) => !keysPresent.has(k));
    return { missing, keysPresent };
  }

  const { missing } = requiredCoverage();

  return (
    <div style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800 }}>Patient Photos</h2>
      <p style={{ color: "#555", marginTop: 6 }}>
        Upload all required Basic Audit photos: pre-op (front, left, right, top, crown, donor rear) and day-of surgery (recipient + donor). The audit score gets more accurate with better photos.
      </p>

      {missing.length ? (
        <div style={{ padding: 12, border: "1px solid #f2c94c", borderRadius: 12, background: "#fff8e1", marginTop: 10 }}>
          <b>Missing required photos:</b> {missing.join(", ")}
        </div>
      ) : (
        <div style={{ padding: 12, border: "1px solid #6fcf97", borderRadius: 12, background: "#eafaf1", marginTop: 10 }}>
          <b>Required baseline photos complete ✅</b>
        </div>
      )}

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <label htmlFor="patient-photo-category" style={{ fontWeight: 700 }}>Category</label>
        <select
          id="patient-photo-category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as PatientPhotoCategory)}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", maxWidth: 420 }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}{c.required ? " *" : ""}
            </option>
          ))}
        </select>

        <label htmlFor="patient-photo-files" style={{ fontWeight: 700, marginTop: 8 }}>Choose photo(s)</label>
        <input
          id="patient-photo-files"
          name="patient-photos"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />

        {previews.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10 }}>
            {previews.map((src, i) => (
              <img
                key={i}
                src={src}
                alt="preview"
                style={{ width: "100%", borderRadius: 12, border: "1px solid #eee" }}
              />
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10 }}>
          <button
            onClick={uploadNow}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {busy ? "Uploading…" : "Upload Photos"}
          </button>

          {msg ? <div style={{ color: msg.includes("failed") ? "crimson" : "green" }}>{msg}</div> : null}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800 }}>Uploaded files</h3>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
          (These are stored in Supabase Storage and recorded in the uploads table.)
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {uploads.slice(0, 20).map((u) => (
            <div
              key={u.id}
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <b>{u.type}</b>
                <div style={{ color: "#777" }}>{u.storage_path}</div>
              </div>
              <div style={{ color: "#777", whiteSpace: "nowrap" }}>
                {new Date(u.created_at).toLocaleString()}
              </div>
            </div>
          ))}
          {!uploads.length ? <div style={{ color: "#777" }}>No uploads yet.</div> : null}
        </div>
      </div>
    </div>
  );
}
