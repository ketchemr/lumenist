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
      {
        source: "/aboutartist.html",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/aboutprints.html",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/printsbetter.html",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/prices.html",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/contactinfo.html",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/shows.html",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/search.html",
        destination: "/explore",
        permanent: true,
      },
      {
        source: "/keywords.html",
        destination: "/explore",
        permanent: true,
      },
      {
        source: "/rss_explain.html",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/down.html",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
