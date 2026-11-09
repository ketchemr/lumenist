import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";

const COOKIE_NAME = "lumenist_admin_token";
const DEFAULT_PASSWORD = "lumenist-admin";

function getAuthFilePath(): string {
  return path.join(process.cwd(), "data", "auth.json");
}

interface StoredAuth {
  salt: string;
  hash: string;
  updatedAt: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

export function setAdminPassword(newPassword: string): void {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(newPassword.trim(), salt);
  const data: StoredAuth = {
    salt,
    hash,
    updatedAt: new Date().toISOString(),
  };
  const authFile = getAuthFilePath();
  const dir = path.dirname(authFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(authFile, JSON.stringify(data, null, 2), "utf-8");
}

function getSecretKey(): string {
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

export function verifyAdminPassword(password: string): boolean {
  const authFile = getAuthFilePath();
  if (fs.existsSync(authFile)) {
    try {
      const stored: StoredAuth = JSON.parse(fs.readFileSync(authFile, "utf-8"));
      if (stored.salt && stored.hash) {
        const calculated = hashPassword(password.trim(), stored.salt);
        return crypto.timingSafeEqual(
          Buffer.from(calculated, "hex"),
          Buffer.from(stored.hash, "hex")
        );
      }
    } catch (e) {
      console.warn("Could not read auth.json, falling back to env:", e);
    }
  }
  const currentPassword = getAdminPassword();
  return password.trim() === currentPassword.trim();
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
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const time = parseInt(timestamp, 10);
  if (isNaN(time)) return false;

  // Token expires after 30 days
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - time > thirtyDaysMs) return false;

  const key = getSecretKey();
  const expectedSignature = crypto
    .createHmac("sha256", key)
    .update(timestamp)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
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
