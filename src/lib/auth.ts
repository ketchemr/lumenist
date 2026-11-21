import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";

const COOKIE_NAME = "lumenist_admin_token";
const DEFAULT_PASSWORD = "lumenist-admin";
const PLACEHOLDER_SECRETS = new Set([
  "",
  "lumenist-admin",
  "change-me-to-a-secure-random-string",
]);

function getAuthFilePath(): string {
  return path.join(process.cwd(), "data", "auth.json");
}

interface StoredAuth {
  salt?: string;
  hash?: string;
  sessionSecret?: string;
  updatedAt?: string;
}

function readStoredAuth(): StoredAuth {
  const authFile = getAuthFilePath();
  if (!fs.existsSync(authFile)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(authFile, "utf-8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.warn("Could not read auth.json:", e);
    return {};
  }
}

function writeStoredAuth(data: StoredAuth): void {
  const authFile = getAuthFilePath();
  const dir = path.dirname(authFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(authFile, JSON.stringify(data, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function setAdminPassword(newPassword: string): void {
  const existing = readStoredAuth();
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(newPassword.trim(), salt);
  // Rotate sessionSecret on every password change so all prior sessions are invalidated
  const sessionSecret = crypto.randomBytes(32).toString("hex");
  const data: StoredAuth = {
    ...existing,
    salt,
    hash,
    sessionSecret,
    updatedAt: new Date().toISOString(),
  };
  writeStoredAuth(data);
}

let fallbackEphemeralSecret: string | null = null;

function getOrCreatePersistedSessionSecret(): string {
  const stored = readStoredAuth();
  if (stored.sessionSecret && stored.sessionSecret.length >= 32) {
    return stored.sessionSecret;
  }
  const generated = crypto.randomBytes(32).toString("hex");
  try {
    writeStoredAuth({
      ...stored,
      sessionSecret: generated,
    });
    return generated;
  } catch (e) {
    console.warn("Could not persist generated sessionSecret; using ephemeral secret:", e);
    if (!fallbackEphemeralSecret) {
      fallbackEphemeralSecret = generated;
    }
    return fallbackEphemeralSecret;
  }
}

function getSecretKey(): string {
  const envSecret = (process.env.ADMIN_SECRET || "").trim();
  const stored = readStoredAuth();

  // Always mix in a cryptographically random per-server secret so:
  // 1) A missing or placeholder ADMIN_SECRET never falls back to a public hardcoded default.
  // 2) Rotating sessionSecret on password change invalidates all existing tokens.
  const persistedSecret =
    stored.sessionSecret && stored.sessionSecret.length >= 32
      ? stored.sessionSecret
      : getOrCreatePersistedSessionSecret();

  const material =
    envSecret && !PLACEHOLDER_SECRETS.has(envSecret)
      ? `${envSecret}:${persistedSecret}`
      : persistedSecret;

  return crypto.createHash("sha256").update(material).digest("hex");
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

export function verifyAdminPassword(password: unknown): boolean {
  if (typeof password !== "string" || !password.trim()) {
    return false;
  }
  const trimmed = password.trim();
  const stored = readStoredAuth();
  if (stored.salt && stored.hash) {
    try {
      const calculated = hashPassword(trimmed, stored.salt);
      const calcBuf = Buffer.from(calculated, "hex");
      const hashBuf = Buffer.from(stored.hash, "hex");
      if (calcBuf.length === hashBuf.length) {
        return crypto.timingSafeEqual(calcBuf, hashBuf);
      }
    } catch (e) {
      console.warn("Could not verify stored auth hash:", e);
    }
  }
  const currentPassword = getAdminPassword();
  return timingSafeStringEqual(trimmed, currentPassword.trim());
}

export function createAdminToken(): string {
  const key = getSecretKey();
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", key)
    .update(timestamp)
    .digest("hex");
  return `${timestamp}.${signature}`;
}

export function verifyAdminToken(token?: string | null): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  if (!/^\d{10,16}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const time = parseInt(timestamp, 10);
  if (isNaN(time)) return false;

  const now = Date.now();
  // Reject tokens from the future (> 1 min clock skew) or older than 30 days
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (time > now + 60_000 || now - time > thirtyDaysMs) return false;

  const key = getSecretKey();
  const expectedSignature = crypto
    .createHmac("sha256", key)
    .update(timestamp)
    .digest("hex");

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

export async function isAuthenticatedAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

export { COOKIE_NAME };
