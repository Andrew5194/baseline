import type { NextConfig } from "next";

// Same-origin API/auth proxying is handled at runtime in middleware.ts (so the
// target honors API_INTERNAL_URL per environment). It intentionally does NOT live
// in `rewrites()` here, because rewrite destinations are baked at build time and
// couldn't then vary between Docker, Cloud Run, etc.
const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
};

export default nextConfig;
