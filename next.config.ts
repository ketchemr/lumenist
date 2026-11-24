import type { NextConfig } from "next";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import packageJson from "./package.json";

function resolveDistDir(): string {
  if (process.env.NEXT_DIST_DIR) {
    return process.env.NEXT_DIST_DIR;
  }
  if (process.env.NODE_ENV === "production") {
    try {
      const active = fs
        .readFileSync(path.join(process.cwd(), ".next-active"), "utf-8")
        .trim();
      if (active === ".next-a" || active === ".next-b") {
        return active;
      }
    } catch {
      // Fall back to default .next when no A/B slot pointer exists
    }
  }
  return ".next";
}

function getGitRevisionTimestamp(): string {
  try {
    const output = execSync(
      'git log -1 --format=%cd --date=format:"%Y-%m-%d %H:%M:%S"',
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    if (output) return output;
  } catch {
    // Fallback if .git is unavailable (e.g. archive/zip install)
  }
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

const nextConfig: NextConfig = {
  distDir: resolveDistDir(),
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version || "0.1.0",
    NEXT_PUBLIC_APP_REV_DATE: getGitRevisionTimestamp(),
  },
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
