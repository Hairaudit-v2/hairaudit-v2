"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function MainContentTarget() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    if (!main.id) {
      main.id = "main-content";
    }
    if (!main.hasAttribute("tabindex")) {
      main.setAttribute("tabindex", "-1");
    }
  }, [pathname]);

  return null;
}
