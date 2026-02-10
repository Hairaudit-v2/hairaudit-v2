"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UploadType = "photo" | "op_note" | "invoice" | "other";

export default function UploadPanel({ caseId }: { caseId: string }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [type, setType] = useState<UploadType>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!file) {
      setMsg("❌ Please choose a file.");
      return;
    }

    setBusy(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      setBusy(false);
      setMsg("❌ Not signed in. Please log in again.");
      router.push("/login");
      return;
    }

    const userId = userRes.user.id;
    const uploadId = crypto.randomUUID();
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${caseId}/${uploadId}.${ext}`;

    // Upload to storage
    const { error: storageErr } = await supabase.storage
      .from("case-files")
      .upload(path, file, { upsert: false });

    if (storageErr) {
      setBusy(false);
      setMsg(`❌ Storage upload failed: ${storageErr.message}`);
      return;
    }

    // Record in DB
    const { error: dbErr } = await supabase.from("uploads").insert({
      id: uploadId,
      case_id: caseId,
      user_id: userId,
      type,
      storage_path: path,
      metadata: {
        originalName: file.name,
        size: file.size,
        mime: file.type,
      },
    });

    if (dbErr) {
      setBusy(false);
      setMsg(`❌ DB insert failed: ${dbErr.message}`);
      return;
    }

    setBusy(false);
    setFile(null);
    setMsg("✅ Uploaded!");
    router.refresh();
  }

  return (
    <form onSubmit={onUpload} style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as UploadType)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        >
          <option value="photo">Photo</option>
          <option value="op_note">Op notes</option>
          <option value="invoice">Invoice</option>
          <option value="other">Other</option>
        </select>

        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <button type="submit" disabled={busy} style={{ padding: 10, borderRadius: 8 }}>
          {busy ? "Uploading..." : "Upload"}
        </button>
      </div>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
    </form>
  );
}