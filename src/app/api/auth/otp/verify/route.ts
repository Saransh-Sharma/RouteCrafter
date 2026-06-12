import { NextResponse } from "next/server";
import { otpVerifySchema } from "@/lib/schemas/auth";
import { findUserByUsername } from "@/lib/auth/users";
import { signToken } from "@/lib/auth/jwt";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { authIdentifier, parseJsonBody } from "@/lib/auth/http";
import {
  checkRateLimit,
  rateLimitHeaders,
} from "@/lib/auth/rate-limit";
import { verifyOtpChallenge } from "@/lib/auth/otp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(
      request,
      otpVerifySchema,
      "Valid username and 6-digit code are required",
    );
    if (!parsed.ok) return parsed.response;

    const { username, code } = parsed.data;
    const rateLimit = await checkRateLimit(
      "otp-verify",
      authIdentifier(request, username),
    );
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimit.reset) },
      );
    }

    const user = findUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid code. Please try again." },
        { status: 401 },
      );
    }

    const result = await verifyOtpChallenge(user.username, code);
    if (result === "missing") {
      return NextResponse.json(
        { error: "No OTP found. Please request a new code." },
        { status: 400 },
      );
    }
    if (result === "expired") {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new code." },
        { status: 400 },
      );
    }
    if (result === "attempts-exhausted") {
      return NextResponse.json(
        { error: "Too many invalid attempts. Please request a new code." },
        { status: 401 },
      );
    }
    if (result === "invalid") {
      return NextResponse.json(
        { error: "Invalid code. Please try again." },
        { status: 401 },
      );
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });

    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
    return response;
  } catch (error) {
    console.error("OTP verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
