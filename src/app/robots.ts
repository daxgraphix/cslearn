import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/instructor/", "/reviewer/", "/learner/", "/organization/", "/support/", "/api/", "/auth/", "/login", "/register", "/reset-password", "/forgot-password"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
