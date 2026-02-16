"use client";

import { useMemo, useState } from "react";

type UploadItem = {
  id: string;
  type: string;
  storage_path: string;
  created_at: string;
  metadata?: any;
};

type Props = {
  caseId: string;
};

const REQUIRED_CATEGORIES = [
  { id: "preop_front", label: "Pre-op — Front" },
  { id: "preop_left", label: "Pre-op — Left side" },
  { id: "preop_right", label: "Pre-op — Right side" },
  { id: "preop_top", label: "Pre-op — Top" },
  { id: "preop_crown", label: "Pre-op — Crown" },
  { id: "preop_donor_rear", label: "Pre-op — Donor (rear)" },
  { id: "day0_recipient", label: "Day-of surgery — Recipient (post-implant)" },
  { id: "day0_donor", label: "Day-of surgery — Donor" },
] as const;

export default function AuditPhotoUploadClient({ caseId }: Props) {
  const [busyCat, setBusyCat] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  // Local previews by category (instant UX)
  const [previews, setPreviews] = useState<Record<string, string[]>>({});

  async function upload(category: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setMsg("");
    setBusyCat(category);

    // previews
    const urls = Array.from(files).map((f) => URL.createObjectURL(f));
    setPreviews((p) => ({ ...p, [category]: [...(p[category] ?? []), ...urls] }));

    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);

    const res = await fetch(
      `/api/uploads/patient-photos?caseId=${encodeURIComponent(caseId)}&category=${encodeURIComponent(category)}`,
      { method: "POST", body: fd }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMsg(`Upload failed: ${data?.error ?? res.statusText}`);
    } else {
      setMsg(`Uploaded ✅ (${data.savedCount ?? 0})`);
    }

    setBusyCat("");
  }

  return (
    <div style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Photo Uploads</h2>
      <div style={{ color: "#666", marginBottom: 14 }}>
        Upload the required photos below to run a Basic Audit.
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {REQUIRED_CATEGORIES.map((c) => (
          <div
            key={c.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 14,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900 }}>{c.label}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  JPG/PNG preferred. You can add multiple images.
                </div>
              </div>

              <label
                htmlFor={`audit-photo-upload-${c.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  cursor: busyCat ? "not-allowed" : "pointer",
                  opacity: busyCat && busyCat !== c.id ? 0.5 : 1,
                  fontWeight: 800,
                }}
              >
                {busyCat === c.id ? "Uploading…" : "Choose files"}
                <input
                  id={`audit-photo-upload-${c.id}`}
                  name={`audit-photos-${c.id}`}
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={Boolean(busyCat)}
                  style={{ display: "none" }}
                  onChange={(e) => upload(c.id, e.target.files)}
                />
              </label>
            </div>

            {(previews[c.id] ?? []).length > 0 ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                {(previews[c.id] ?? []).map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt=""
                    style={{
                      width: 110,
                      height: 110,
                      objectFit: "cover",
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {msg ? (
        <div style={{ marginTop: 14, color: msg.includes("failed") ? "crimson" : "green" }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}
