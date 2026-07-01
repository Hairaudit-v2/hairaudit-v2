import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isClinicProvisionPayload,
  type HaNexusProvisionPayload,
  type ProvisionResult,
} from "@/lib/nexus/nexusProvisioningTypes";
import { provisionExternalClinicFromNexus } from "@/lib/nexus/provisionExternalClinic.server";
import { provisionExternalProfessionalFromNexus } from "@/lib/nexus/provisionExternalProfessional.server";

export async function provisionFromNexus(
  payload: HaNexusProvisionPayload,
  client?: SupabaseClient
): Promise<ProvisionResult | Awaited<ReturnType<typeof provisionExternalClinicFromNexus>>> {
  if (isClinicProvisionPayload(payload)) {
    return provisionExternalClinicFromNexus(payload, client);
  }
  return provisionExternalProfessionalFromNexus(payload, client);
}

export async function provisionFromNexusWithAdmin(
  payload: HaNexusProvisionPayload,
  client?: SupabaseClient
) {
  const supabase = client ?? createSupabaseAdminClient();
  return provisionFromNexus(payload, supabase);
}
