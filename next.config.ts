import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // Allows serving local files / static exports cleanly
  },
  async redirects() {
    return [
      {
        source: "/map",
        destination: "/explore",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
