"use server";

import { cookies } from "next/headers";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const admin = tryCreateSupabaseAdminClient();
  const supabase = admin ?? await createSupabaseAuthServerClient();
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(pdfPath, 60); // 60 seconds

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not generate download URL");
  }

  return data.signedUrl;
}