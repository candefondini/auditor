import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://prompte.ar/",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    // Agregá más rutas si tenés otras páginas:
    // { url: "https://promte.ar/auditor", changeFrequency: "weekly", priority: 0.8 },
  ];
}
