// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ✅ no frena el build si hay errores de ESLint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
