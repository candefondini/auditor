// next.config.ts
import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",

  // IMG: incluye píxeles de GA y FB + data/blob
  "img-src 'self' data: blob: https://www.google-analytics.com https://www.facebook.com https://connect.facebook.net",

  // SCRIPTS: GTM, GA y Pixel de Meta
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net",

  // STYLES/FUENTES
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",

  // FETCH/XHR/Beacon: GA y endpoints de Facebook
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.facebook.com https://graph.facebook.com",

  // IFRAMES (GTM y Facebook)
  "frame-src https://www.googletagmanager.com https://www.facebook.com",

  // Si querés usar el Tag Assistant de GTM, permití que tu sitio se embeber en su iframe:
  // ⚠️ Si tu política requiere bloquear todo embedding, volvé a 'none'.
  "frame-ancestors 'self' https://tagassistant.google.com",

  "object-src 'none'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" }, // Puedes quitarlo si usas frame-ancestors con Tag Assistant
          { key: "X-Robots-Tag", value: "index, follow" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
