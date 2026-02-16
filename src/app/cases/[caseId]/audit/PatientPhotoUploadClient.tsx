"use client";

import { useMemo, useState } from "react";

type Props = { caseId: string };

type Category = {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  multiple?: boolean;
};

export default function PatientPhotoUpload({ caseId }: Props) {
  const categories: Category[] = useMemo(
    () => [
      // Pre-op (minimum)
      { id: "preop_front", label: "Pre-op: Front", required: true },
      { id: "preop_left", label: "Pre-op: Left", required: true },
      { id: "preop_right", label: "Pre-op: Right", required: true },
      { id: "preop_top", label: "Pre-op: Top", required: true },
      { id: "preop_crown", label: "Pre-op: Crown", required: true },
      { id: "preop_donor_rear", label: "Pre-op: Donor (rear)", required: true },

      // Surgery day (minimum)
      { id: "day0_donor", label: "Surgery day: Donor photos", required: true, multiple: true },
      { id: "day0_recipient", label: "Surgery day: Recipient photos", required: true, multiple: true },

      // Optional follow-ups
      { id: "day7", label: "Day 7 follow-up (optional)", multiple: true },
      { id: "month1", label: "1 month follow-up (optional)", multiple: true },
      { id: "month3", label: "3 month follow-up (optional)", multiple: true },
      { id: "month6", label: "6 month follow-up (optional)", multiple: true },
    ],
    []
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  async function upload(catId: string, files: FileList | null) {
    if (!files || files.length === 0) return;

    setBusy(catId);
    setMsg("");

    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);

    const res = await fetch(
      `/api/uploads/patient-photos?caseId=${encodeURIComponent(caseId)}&category=${encodeURIComponent(catId)}`,
      { method: "POST", body: fd }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(`Upload failed: ${data?.error ?? res.statusText}`);
    else setMsg(`Uploaded ✅ (${data.savedCount} file(s))`);

    setBusy(null);
  }

  return (
    <div style={{ marginTop: 18, border: "1px solid #e6e8ee", borderRadius: 16, padding: 14 }}>
      <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>Patient Photos</div>
      <div style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>
        Upload your baseline photos + surgery-day photos to run a Basic Audit.
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {categories.map((c) => (
          <div key={c.id} style={{ display: "grid", gap: 6 }}>
            <label htmlFor={`audit-patient-photo-${c.id}`} style={{ fontWeight: 800 }}>
              {c.label} {c.required ? <span style={{ color: "crimson" }}>*</span> : null}
            </label>

            <input
              id={`audit-patient-photo-${c.id}`}
              name={`audit-patient-photos-${c.id}`}
              type="file"
              accept="image/*"
              multiple={Boolean(c.multiple)}
              onChange={(e) => upload(c.id, e.target.files)}
              disabled={busy !== null}
            />

            {busy === c.id ? <div style={{ fontSize: 12, color: "#666" }}>Uploading…</div> : null}
          </div>
        ))}
      </div>

      {msg ? (
        <div style={{ marginTop: 12, color: msg.toLowerCase().includes("failed") ? "crimson" : "green" }}>{msg}</div>
      ) : null}
    </div>
  );
}
