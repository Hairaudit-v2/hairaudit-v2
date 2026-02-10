"use client";

import { useEffect, useMemo, useState } from "react";

type UploadItem = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: any;
  created_at: string;
  signedUrl?: string | null;
};

const REQUIRED_PREOP = [
  { id: "preop_front", label: "Pre-op Front" },
  { id: "preop_left", label: "Pre-op Left" },
  { id: "preop_right", label: "Pre-op Right" },
  { id: "preop_top", label: "Pre-op Top" },
  { id: "preop_crown", label: "Pre-op Crown" },
  { id: "preop_donor_back", label: "Pre-op Donor (Rear)" },
];

const REQUIRED_DAY0 = [
  { id: "day0_recipient", label: "Day-of Surgery Recipient (post-implant)" },
  { id: "day0_donor", label: "Day-of Surgery Donor (post-extraction)" },
];

const OPTIONAL_FOLLOWUPS = [
  {
    title: "7 Days Post",
    items: [
      "day7_front",
      "day7_left",
      "day7_right",
      "day7_top",
      "day7_crown",
      "day7_donor_back",
    ].map((id) => ({ id, label: id.replaceAll("_", " ") })),
  },
  {
    title: "1 Month Post",
    items: [
      "m1_front",
      "m1_left",
      "m1_right",
      "m1_top",
      "m1_crown",
      "m1_donor_back",
    ].map((id) => ({ id, label: id.replaceAll("_", " ") })),
  },
  {
    title: "3 Months Post",
    items: [
      "m3_front",
      "m3_left",
      "m3_right",
      "m3_top",
      "m3_crown",
      "m3_donor_back",
    ].map((id) => ({ id, label: id.replaceAll("_", " ") })),
  },
  {
    title: "6 Months Post",
    items: [
      "m6_front",
      "m6_left",
      "m6_right",
      "m6_top",
      "m6_crown",
      "m6_donor_back",
    ].map((id) => ({ id, label: id.replaceAll("_", " ") })),
  },
];

export default function PatientPhotoUpload({ caseId }: { caseId: string }) {
  const [byCategory, setByCategory] = useState<Record<string, UploadItem[]>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<string>("");

  async function refresh() {
    const res = await fetch(`/api/uploads/list?caseId=${caseId}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setByCategory(data.byCategory || {});
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  function hasAny(cat: string) {
    return Array.isArray(byCategory?.[cat]) && byCategory[cat].length > 0;
  }

  async function upload(cat: string, files: FileList | null) {
    if (!files || files.length === 0) return;

    setBusy((p) => ({ ...p, [cat]: true }));
    setMsg("");

    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);

    const res = await fetch(`/api/uploads/patient-photos?caseId=${caseId}&category=${cat}`, {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(`Upload failed (${cat}): ${data?.error ?? res.statusText}`);
    } else {
      setMsg(`Uploaded ✅ (${cat})`);
      await refresh();
    }

    setBusy((p) => ({ ...p, [cat]: false }));
  }

  const completion = useMemo(() => {
    const required = [...REQUIRED_PREOP, ...REQUIRED_DAY0];
    const done = required.filter((x) => hasAny(x.id)).length;
    return { done, total: required.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCategory]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          border: "1px solid #e6e8ee",
          borderRadius: 16,
          padding: 14,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Basic Audit Photo Checklist</div>
        <div style={{ color: "#555" }}>
          Completed: <b>{completion.done}</b> / {completion.total}
        </div>
        {msg ? (
          <div style={{ marginTop: 10, color: msg.includes("failed") ? "crimson" : "green" }}>
            {msg}
          </div>
        ) : null}
      </div>

      <Section title="Required: Pre-op Photos" items={REQUIRED_PREOP} busy={busy} hasAny={hasAny} onUpload={upload} />

      <Section title="Required: Day-of Surgery Photos" items={REQUIRED_DAY0} busy={busy} hasAny={hasAny} onUpload={upload} />

      <details style={{ border: "1px solid #e6e8ee", borderRadius: 16, padding: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 900 }}>Optional follow-ups</summary>
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {OPTIONAL_FOLLOWUPS.map((grp) => (
            <Section key={grp.title} title={grp.title} items={grp.items} busy={busy} hasAny={hasAny} onUpload={upload} />
          ))}
        </div>
      </details>

      <details style={{ border: "1px solid #e6e8ee", borderRadius: 16, padding: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 900 }}>Preview uploaded photos</summary>
        <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
          {Object.keys(byCategory).length === 0 ? (
            <div style={{ color: "#666" }}>No uploads yet.</div>
          ) : (
            Object.entries(byCategory).map(([cat, arr]) => (
              <div key={cat}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>{cat}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {arr.map((u) => (
                    <a
                      key={u.id}
                      href={u.signedUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "block" }}
                    >
                      {/* thumbnail */}
                      <img
                        src={u.signedUrl ?? ""}
                        alt={cat}
                        style={{
                          width: 140,
                          height: 140,
                          objectFit: "cover",
                          borderRadius: 12,
                          border: "1px solid #e6e8ee",
                          background: "#f7f8fb",
                        }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
}

function Section({
  title,
  items,
  busy,
  hasAny,
  onUpload,
}: {
  title: string;
  items: { id: string; label: string }[];
  busy: Record<string, boolean>;
  hasAny: (cat: string) => boolean;
  onUpload: (cat: string, files: FileList | null) => void;
}) {
  return (
    <div style={{ border: "1px solid #e6e8ee", borderRadius: 16, padding: 14, background: "#fff" }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((x) => (
          <div
            key={x.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              alignItems: "center",
              padding: 10,
              borderRadius: 12,
              border: "1px solid #eef1f7",
            }}
          >
            <div>
              <div style={{ fontWeight: 800 }}>
                {hasAny(x.id) ? "✅ " : "⬜ "} {x.label}
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>{x.id}</div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label
                style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  cursor: busy[x.id] ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  background: busy[x.id] ? "#f3f4f6" : "#fff",
                }}
              >
                {busy[x.id] ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={busy[x.id]}
                  style={{ display: "none" }}
                  onChange={(e) => onUpload(x.id, e.target.files)}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
