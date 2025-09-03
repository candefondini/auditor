// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ✅ no frena el build si hay errores de ESLint
    ignoreDuringBuilds: true,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // HSTS (1 año)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Robots (no bloqueante)
          { key: "X-Robots-Tag", value: "index, follow" },
          // CSP mínima compatible con GTM + GA
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com",
              "frame-src https://www.googletagmanager.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
