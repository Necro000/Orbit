import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only needed for custom Docker containers, not on Vercel
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  devIndicators: false,
};

export default nextConfig;
