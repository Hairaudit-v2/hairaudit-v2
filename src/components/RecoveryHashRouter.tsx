"use client";

import { useEffect } from "react";

export default function RecoveryHashRouter() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (!hash.includes("access_token=")) return;

    const isRecovery = hash.includes("type=recovery");
    const isMagicLink = hash.includes("type=magiclink");

    if (isRecovery) {
      if (window.location.pathname === "/auth/recovery") return;
      window.location.replace(`/auth/recovery${hash}`);
      return;
    }

    if (isMagicLink) {
      if (window.location.pathname === "/auth/magic-link") return;
      window.location.replace(`/auth/magic-link${hash}`);
    }
  }, []);

  return null;
}
