// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://prompte.ar";

  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: "oai-searchbot", allow: "/" },
      { userAgent: "GPTBot", allow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
