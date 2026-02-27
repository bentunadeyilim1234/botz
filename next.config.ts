import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://ws.alitunabaylan.com.tr/api/:path*',
      },
      {
        source: '/ws/:path*',
        destination: 'https://ws.alitunabaylan.com.tr/ws/:path*',
      },
    ];
  },
};

export default nextConfig;
