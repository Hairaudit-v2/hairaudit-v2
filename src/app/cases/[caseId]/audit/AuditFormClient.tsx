"use client";

import { useEffect, useMemo, useState } from "react";

const PATIENT_REQUIRED_CATEGORIES = [
  "preop_front",
  "preop_left",
  "preop_right",
  "preop_top",
  "preop_crown",
  "preop_donor_rear",
  "day0_recipient",
  "day0_donor",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  preop_front: "Pre-op: Front",
  preop_left: "Pre-op: Left side",
  preop_right: "Pre-op: Right side",
  preop_top: "Pre-op: Top",
  preop_crown: "Pre-op: Crown",
  preop_donor_rear: "Pre-op: Donor (rear)",
  day0_recipient: "Day-of surgery: Recipient",
  day0_donor: "Day-of surgery: Donor",
};

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata: any;
  created_at: string;
  signedUrl?: string | null;
};

export default function PatientPhotoUpload({ caseId }: { caseId: string }) {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  async function refresh() {
    const res = await fetch(`/api/uploads/list?caseId=${caseId}&prefix=patient_photo`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setUploads(data.uploads ?? []);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const uploadsByCategory = useMemo(() => {
    const map: Record<string, UploadRow[]> = {};
    for (const u of uploads) {
      const cat = u.metadata?.category ?? "uncategorized";
      map[cat] = map[cat] || [];
      map[cat].push(u);
    }
    return map;
  }, [uploads]);

  const completion = useMemo(() => {
    const missing = PATIENT_REQUIRED_CATEGORIES.filter((c) => !(uploadsByCategory[c]?.length));
    return { missing, complete: missing.length === 0 };
  }, [uploadsByCategory]);

  async function uploadFiles(category: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(category);
    setMsg("");

    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));

    const res = await fetch(
      `/api/uploads/patient-photos?caseId=${caseId}&category=${encodeURIComponent(category)}`,
      { method: "POST", body: fd }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(`Upload failed: ${data?.error ?? res.statusText}`);
    } else {
      setMsg(`Uploaded ✅ (${data.savedCount ?? 0})`);
      await refresh();
    }
    setBusy(null);
  }

  return (
    <div style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Patient Photos (Basic Audit)</h2>

      <div style={{ color: completion.complete ? "green" : "#a15c00", marginBottom: 12 }}>
        {completion.complete
          ? "Minimum photo set complete ✅"
          : `Missing: ${completion.missing.map((c) => CATEGORY_LABELS[c] ?? c).join(", ")}`}
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {PATIENT_REQUIRED_CATEGORIES.map((cat) => {
          const existing = uploadsByCategory[cat] ?? [];
          return (
            <div
              key={cat}
              style={{
                border: "1px solid #e6e8ee",
                borderRadius: 14,
                padding: 12,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 800 }}>{CATEGORY_LABELS[cat] ?? cat}</div>
                <div style={{ color: existing.length ? "green" : "crimson", fontWeight: 700 }}>
                  {existing.length ? `Uploaded (${existing.length})` : "Missing"}
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={busy === cat}
                  onChange={(e) => uploadFiles(cat, e.target.files)}
                />
                {busy === cat ? <span style={{ color: "#666" }}>Uploading…</span> : null}
              </div>

              {existing.length ? (
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {existing.slice(-6).map((u) => (
                    <div key={u.id} style={{ width: 120 }}>
                      {u.signedUrl ? (
                        <img
                          src={u.signedUrl}
                          style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 10 }}
                        />
                      ) : (
                        <div style={{ width: 120, height: 120, border: "1px solid #ddd", borderRadius: 10 }} />
                      )}
                      <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                        {new Date(u.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {msg ? (
        <div style={{ marginTop: 12, color: msg.includes("failed") ? "crimson" : "green" }}>{msg}</div>
      ) : null}
    </div>
  );
}
