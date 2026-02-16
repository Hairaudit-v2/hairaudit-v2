"use client";

import { useMemo, useState } from "react";

type UploadCategory =
  | "preop_front"
  | "preop_left"
  | "preop_right"
  | "preop_top"
  | "preop_crown"
  | "preop_donor_rear"
  | "day0_recipient"
  | "day0_donor"
  | "fu_7d"
  | "fu_1m"
  | "fu_3m"
  | "fu_6m";

type CategoryDef = {
  id: UploadCategory;
  label: string;
  required?: boolean;
  hint?: string;
};

export default function PatientPhotoUpload({ caseId }: { caseId: string }) {
  const categories: CategoryDef[] = useMemo(
    () => [
      { id: "preop_front", label: "Pre-op: Front", required: true },
      { id: "preop_left", label: "Pre-op: Left side", required: true },
      { id: "preop_right", label: "Pre-op: Right side", required: true },
      { id: "preop_top", label: "Pre-op: Top", required: true },
      { id: "preop_crown", label: "Pre-op: Crown", required: true },
      { id: "preop_donor_rear", label: "Pre-op: Donor (rear)", required: true },

      { id: "day0_recipient", label: "Day 0: Recipient (post implantation)", required: true },
      { id: "day0_donor", label: "Day 0: Donor (post extraction)", required: true },

      { id: "fu_7d", label: "Follow-up: 7 days", hint: "Recommended" },
      { id: "fu_1m", label: "Follow-up: 1 month", hint: "Recommended" },
      { id: "fu_3m", label: "Follow-up: 3 months", hint: "Recommended" },
      { id: "fu_6m", label: "Follow-up: 6 months", hint: "Recommended" },
    ],
    []
  );

  return (
    <div style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Patient Photo Uploads</h2>
      <p style={{ color: "#666", marginTop: 0 }}>
        Upload clear, well-lit photos. You can add multiple photos per category.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {categories.map((cat) => (
          <CategoryUploader key={cat.id} caseId={caseId} category={cat} />
        ))}
      </div>
    </div>
  );
}

function CategoryUploader({
  caseId,
  category,
}: {
  caseId: string;
  category: CategoryDef;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const previews = useMemo(() => {
    return files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
  }, [files]);

  async function upload() {
    setUploading(true);
    setMsg("");

    try {
      if (!files.length) {
        setMsg("Please choose at least 1 file.");
        setUploading(false);
        return;
      }

      const form = new FormData();
      for (const f of files) form.append("files", f);

      const res = await fetch(
        `/api/uploads/patient-photos?caseId=${encodeURIComponent(caseId)}&category=${encodeURIComponent(
          category.id
        )}`,
        { method: "POST", body: form }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(`Upload failed: ${data?.error ?? res.statusText}`);
      } else {
        setMsg(`Uploaded ✅ (${data.savedCount ?? files.length})`);
        setFiles([]);
      }
    } catch (e: any) {
      setMsg(`Upload failed: ${e?.message ?? "Unknown error"}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 14,
        padding: 14,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 800 }}>
          {category.label}{" "}
          {category.required ? <span style={{ color: "crimson" }}>*</span> : null}
          {category.hint ? <span style={{ color: "#777", fontWeight: 600 }}> — {category.hint}</span> : null}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <label htmlFor="audit-patient-photo-upload" style={{ fontWeight: 700 }}>Choose photo(s)</label>
        <input
          id="audit-patient-photo-upload"
          name="auditPatientPhotos"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />

        {previews.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {previews.map((p) => (
              <div key={p.url} style={{ width: 110 }}>
                <img
                  src={p.url}
                  alt={p.name}
                  style={{
                    width: 110,
                    height: 110,
                    objectFit: "cover",
                    borderRadius: 12,
                    border: "1px solid #eee",
                  }}
                />
                <div style={{ fontSize: 11, color: "#666", marginTop: 4, wordBreak: "break-word" }}>
                  {p.name}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={upload}
            disabled={uploading}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>

          {msg ? (
            <div style={{ color: msg.includes("failed") ? "crimson" : "green", fontWeight: 700 }}>
              {msg}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
