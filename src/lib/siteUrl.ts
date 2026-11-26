import { headers } from "next/headers";

/**
 * Resolves the canonical site origin without hardcoding any domain.
 * Priority:
 *  1. NEXT_PUBLIC_SITE_URL or SITE_URL environment variable
 *  2. Request Host / X-Forwarded-Host + X-Forwarded-Proto headers
 *  3. http://localhost:3000 fallback (e.g. outside request context)
 */
export async function getSiteUrl(): Promise<string> {
  const configured = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    ""
  ).trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  try {
    const h = await headers();
    const rawHost = (h.get("x-forwarded-host") || h.get("host") || "")
      .split(",")[0]
      .trim();
    const rawProto = (h.get("x-forwarded-proto") || "https")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const proto = rawProto === "http" ? "http" : "https";

    if (rawHost && /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(rawHost)) {
      const normalizedHost = rawHost.replace(/^www\./i, "");
      if (
        !normalizedHost.startsWith("localhost") &&
        !normalizedHost.startsWith("127.0.0.1")
      ) {
        return `${proto}://${normalizedHost}`;
      }
      return `${proto}://${rawHost}`;
    }
  } catch {
    // Outside request context (e.g. build time)
  }

  return "http://localhost:3000";
}
