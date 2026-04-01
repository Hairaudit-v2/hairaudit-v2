import type { SupabaseClient } from "@supabase/supabase-js";

export type AcademySiteRow = {
  id: string;
  name: string;
  slug: string;
  display_name: string | null;
  ops_notification_email: string | null;
  general_contact_email: string | null;
  phone: string | null;
  country: string | null;
  timezone: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function listAcademySites(supabase: SupabaseClient): Promise<AcademySiteRow[]> {
  const { data, error } = await supabase.from("academy_sites").select("*").order("name", { ascending: true });
  if (error || !data) return [];
  return data as AcademySiteRow[];
}

export async function getAcademySiteById(
  supabase: SupabaseClient,
  id: string
): Promise<AcademySiteRow | null> {
  const { data, error } = await supabase.from("academy_sites").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as AcademySiteRow;
}
