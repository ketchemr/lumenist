import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminPassword,
  setAdminPassword,
  createAdminToken,
  verifyAdminToken,
  isAuthenticatedAdmin,
  COOKIE_NAME,
} from "@/lib/auth";

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function isRateLimited(ip: string): boolean {
  const record = failedAttempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.firstAttempt > LOCKOUT_WINDOW_MS) {
    failedAttempts.delete(ip);
    return false;
  }
  return record.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  if (!record || now - record.firstAttempt > LOCKOUT_WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count += 1;
  }
  // Prevent unbounded memory growth
  if (failedAttempts.size > 1000) {
    for (const [key, val] of failedAttempts.entries()) {
      if (now - val.firstAttempt > LOCKOUT_WINDOW_MS) {
        failedAttempts.delete(key);
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!verifyAdminPassword(password)) {
      recordFailure(ip);
      return NextResponse.json(
        { error: "Invalid admin password" },
        { status: 401 }
      );
    }

    failedAttempts.delete(ip);
    const token = createAdminToken();
    const response = NextResponse.json({ success: true });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Authentication error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authenticated = verifyAdminToken(token);
  return NextResponse.json({ authenticated });
}

export async function PATCH(req: NextRequest) {
  try {
    const isAuthed = await isAuthenticatedAdmin();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Both current password and new password are required" },
        { status: 400 }
      );
    }

    if (!verifyAdminPassword(currentPassword)) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    if (newPassword.trim().length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    setAdminPassword(newPassword.trim());

    // Generate fresh token
    const token = createAdminToken();
    const response = NextResponse.json({
      success: true,
      message: "Admin password successfully updated",
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update password" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
