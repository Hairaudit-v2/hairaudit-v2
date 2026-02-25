import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole } from "@/lib/roles";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);

    // After the session is established, create/update the user's profile (role) if possible.
    // This avoids the signup flow failing when email confirmations are enabled (no session at signUp time).
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = parseRole((user.user_metadata as Record<string, unknown>)?.role);
        const admin = createSupabaseAdminClient();
        await admin.from("profiles").upsert(
          {
            id: user.id,
            role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      }
    } catch {
      // If service role env vars aren't set locally, don't block login.
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`); // Redirects to role-specific dashboard
}
