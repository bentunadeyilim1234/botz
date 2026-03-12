import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  reactCompiler: true,
  serverExternalPackages: ['kahoot.js-updated']
};

export default nextConfig;
