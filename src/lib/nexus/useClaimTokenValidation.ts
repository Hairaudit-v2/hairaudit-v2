"use client";

import { useEffect, useState } from "react";

import type { ClaimValidationState } from "@/lib/nexus/claimTokenClient";
import { fetchClaimTokenValidation, persistClaimToken } from "@/lib/nexus/claimTokenClient";

export function useClaimTokenValidation(claimToken: string | null): ClaimValidationState {
  const [state, setState] = useState<ClaimValidationState>(() =>
    claimToken ? { status: "loading" } : { status: "idle" }
  );

  useEffect(() => {
    if (!claimToken) {
      setState({ status: "idle" });
      return;
    }

    persistClaimToken(claimToken);
    let cancelled = false;
    setState({ status: "loading" });

    fetchClaimTokenValidation(claimToken).then((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
    };
  }, [claimToken]);

  return state;
}
