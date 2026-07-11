import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  serverExternalPackages: ['postgres', '@baseline/db', '@node-rs/bcrypt'],
};

export default nextConfig;
