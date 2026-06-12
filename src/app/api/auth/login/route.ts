import { NextResponse } from "next/server";
import { loginCredentialsSchema } from "@/lib/schemas/auth";
import { findUserByUsername, verifyPassword } from "@/lib/auth/users";
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
import { isAuthConfigurationError } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(
      request,
      loginCredentialsSchema,
      "Invalid credentials format",
    );
    if (!parsed.ok) return parsed.response;

    const { username, password } = parsed.data;
    const rateLimit = await checkRateLimit(
      "password",
      authIdentifier(request, username),
    );
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimit.reset) },
      );
    }

    const user = findUserByUsername(username);

    if (!user || !verifyPassword(username, password)) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 },
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

    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);

    return response;
  } catch (error) {
    if (isAuthConfigurationError(error)) {
      console.error("Password login configuration error:", error.message);
      return NextResponse.json(
        {
          error:
            "Authentication is not configured correctly. Please contact the administrator.",
        },
        { status: 500 },
      );
    }

    console.error("Password login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
