import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only needed for custom Docker containers, not on Vercel
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  devIndicators: false,
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/storage-dev/:path*',
        destination: `${apiUrl}/storage-dev/:path*`,
      },
    ];
  },
};

export default nextConfig;
