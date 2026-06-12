import { NextResponse } from "next/server";
import { otpVerifySchema } from "@/lib/schemas/auth";
import { findUserByEmail } from "@/lib/auth/users";
import { signToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function getOtpStore(): Map<string, { code: string; expiresAt: number }> {
  const store = (globalThis as Record<string, unknown>).__rc_otp_store;
  if (store instanceof Map) return store;
  return new Map();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = otpVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valid email and 6-digit code are required" },
        { status: 400 },
      );
    }

    const { email, code } = parsed.data;
    const otpStore = getOtpStore();
    const entry = otpStore.get(email.toLowerCase());

    if (!entry) {
      return NextResponse.json(
        { error: "No OTP found. Please request a new code." },
        { status: 400 },
      );
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return NextResponse.json(
        { error: "OTP has expired. Please request a new code." },
        { status: 400 },
      );
    }

    if (entry.code !== code) {
      return NextResponse.json(
        { error: "Invalid code. Please try again." },
        { status: 401 },
      );
    }

    // OTP verified — clean up
    otpStore.delete(email.toLowerCase());

    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
