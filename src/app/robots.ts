import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? SITE_URL).replace(
      /\/+$/,
      ""
    );

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/beta-access-message",
          "/request-audit",
          "/sample-audit",
          "/verified-program",
          "/admin/",
          "/dashboard/",
          "/cases/",
          "/api/",
          "/dev",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
