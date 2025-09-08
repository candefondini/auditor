// next.config.ts
import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",

  // IMG: incluye píxeles de GA/DoubleClick y FB + data/blob
  "img-src 'self' data: blob: https://www.google-analytics.com https://stats.g.doubleclick.net https://www.facebook.com https://connect.facebook.net",

  // SCRIPTS: GTM, GA y Pixel de Meta
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net",

  // STYLES/FUENTES
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",

  // FETCH/XHR/Beacon: GA (incluye region y doubleclick) + GTM + Facebook
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://www.facebook.com https://graph.facebook.com",

  // IFRAMES (GTM y Facebook)
  "frame-src https://www.googletagmanager.com https://www.facebook.com",

  // Para poder usar Tag Assistant (GTM Preview) sin bloquear el embed
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
          // ❗Quitamos X-Frame-Options: DENY porque entra en conflicto con frame-ancestors (Tag Assistant).
          // Si querés bloquear embebidos, usá sólo `frame-ancestors` que es la directiva moderna y más granular.
          // { key: "X-Frame-Options", value: "DENY" },

          { key: "X-Robots-Tag", value: "index, follow" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
