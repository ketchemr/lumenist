import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "lumenist_admin_token";
const DEFAULT_PASSWORD = "lumenist-admin";

function getSecretKey(): string {
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

export function verifyAdminPassword(password: string): boolean {
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
