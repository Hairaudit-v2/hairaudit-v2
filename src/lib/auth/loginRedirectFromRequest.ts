import { headers } from "next/headers";
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";

/** Preserve the current request path for patient login return URLs. */
export async function loginRedirectPathFromRequest(): Promise<string> {
  const h = await headers();
  return h.get("x-pathname") ?? "/dashboard/patient";
}

export async function buildLoginRedirectFromRequest(): Promise<string> {
  return buildPatientLoginHref(await loginRedirectPathFromRequest());
}
