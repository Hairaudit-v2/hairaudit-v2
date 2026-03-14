import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

const PUBLIC_ROUTES = [
  "/",
  "/how-it-works",
  "/request-review",
  "/sample-report",
  "/audit-examples",
  "/hair-transplant-problems",
  "/hair-transplant-too-thin",
  "/hair-transplant-not-growing",
  "/hair-transplant-donor-overharvested",
  "/hair-transplant-graft-failure",
  "/bad-hair-transplant-hairline",
  "/rate-my-hair-transplant",
  "/is-my-hair-transplant-normal",
  "/great-hair-transplants",
  "/best-hair-transplant-results",
  "/community-results",
  "/clinics",
  "/professionals",
  "/professionals/apply",
  "/verified-surgeon-program",
  "/methodology",
  "/services",
  "/benchmark-vision",
  "/follicle-intelligence",
  "/about",
  "/faq",
  "/privacy",
  "/terms",
  "/disclaimer",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? SITE_URL).replace(
      /\/+$/,
      ""
    );
  const now = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : route === "/request-review" ? 0.9 : 0.7,
  }));
}
