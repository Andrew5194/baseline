import type { NextConfig } from "next";

// Single-origin proxy: the browser only hits the web origin; Next forwards auth +
// API calls to the API server-side, keeping cookies/CSRF same-origin (no CORS).
// Default target follows the topology: the API container in Docker, localhost in
// dev — so neither path needs to set API_INTERNAL_URL.
const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ||
  (process.env.NODE_ENV === 'production' ? 'http://api:3001' : 'http://localhost:3001');

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
