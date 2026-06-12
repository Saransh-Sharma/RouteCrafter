import { NextResponse } from "next/server";
import { otpRequestSchema } from "@/lib/schemas/auth";
import { findUserByUsername } from "@/lib/auth/users";
import { authIdentifier, parseJsonBody } from "@/lib/auth/http";
import {
  checkRateLimit,
  rateLimitHeaders,
} from "@/lib/auth/rate-limit";
import {
  acquireOtpCooldown,
  generateOtp,
  storeOtpChallenge,
} from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/auth/email";
import { isAuthConfigurationError } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(
      request,
      otpRequestSchema,
      "Valid username is required",
    );
    if (!parsed.ok) return parsed.response;

    const { username } = parsed.data;
    const rateLimit = await checkRateLimit(
      "otp-send",
      authIdentifier(request, username),
    );
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many code requests. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimit.reset) },
      );
    }

    const cooldownAcquired = await acquireOtpCooldown(username);
    if (!cooldownAcquired) {
      return NextResponse.json(
        { error: "Please wait before requesting another code." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const user = findUserByUsername(username);
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const code = generateOtp();
    await storeOtpChallenge(user.username, code);
    await sendOtpEmail(user, code);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isAuthConfigurationError(error)) {
      console.error("OTP send configuration error:", error.message);
      return NextResponse.json(
        {
          error:
            "Email sign-in is not configured correctly. Please contact the administrator.",
        },
        { status: 500 },
      );
    }

    console.error("OTP send error:", error);
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 },
    );
  }
}
