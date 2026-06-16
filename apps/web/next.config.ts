import type { NextConfig } from "next";

// Single-origin proxy: the browser only hits the web origin; Next forwards auth +
// API calls to the API container, keeping cookies/CSRF same-origin (no CORS).
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://api:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: `${API_INTERNAL_URL}/api/auth/:path*` },
      { source: '/v1/:path*', destination: `${API_INTERNAL_URL}/v1/:path*` },
    ];
  },
};

export default nextConfig;
