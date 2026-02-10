"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

export async function getReportDownloadUrl(pdfPath: string) {
  if (!pdfPath) {
    throw new Error("Missing PDF path");
  }

  // Optional but recommended: validate caller is logged in
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore.getAll().length > 0;

  if (!hasAuthCookie) {
    throw new Error("Not authenticated");
  }

  const supabase = supabaseAdmin();
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(pdfPath, 60); // 60 seconds

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not generate download URL");
  }

  return data.signedUrl;
}