"use client";

import { useEffect } from "react";

export default function RecoveryHashRouter() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (!hash.includes("type=recovery")) return;
    if (window.location.pathname === "/auth/recovery") return;
    window.location.replace(`/auth/recovery${hash}`);
  }, []);

  return null;
}
