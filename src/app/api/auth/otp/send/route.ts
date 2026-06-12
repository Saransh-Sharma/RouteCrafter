import { NextResponse } from "next/server";
import { otpRequestSchema } from "@/lib/schemas/auth";
import { findUserByEmail } from "@/lib/auth/users";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

/**
 * In-memory OTP store: email → { code, expiresAt }.
 * In production with multiple serverless instances, consider using a KV store.
 * For a small private tool with 3 users this is acceptable.
 */
const otpStore = new Map<string, { code: string; expiresAt: number }>();

/** Generate a random 6-digit code. */
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = otpRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 },
      );
    }

    const { email } = parsed.data;
    const user = findUserByEmail(email);

    if (!user) {
      // Don't reveal whether the email exists
      return NextResponse.json({ ok: true });
    }

    const code = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    otpStore.set(email.toLowerCase(), { code, expiresAt });

    // Export the store entry for the verify route
    (globalThis as Record<string, unknown>).__rc_otp_store = otpStore;

    const resendKey = process.env.RESEND_API_KEY;

    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "RouteCrafter <onboarding@resend.dev>",
        to: email,
        subject: "Your RouteCrafter login code",
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #344e3c; font-size: 24px; margin-bottom: 8px;">RouteCrafter</h2>
            <p style="color: #58534a; font-size: 14px; margin-bottom: 24px;">
              Hi ${user.displayName}, here's your login code:
            </p>
            <div style="background: #f6f1e7; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2c2a24;">
                ${code}
              </span>
            </div>
            <p style="color: #8a8273; font-size: 12px;">
              This code expires in 5 minutes. If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    } else {
      // Dev fallback — log to console
      console.log(`\n📨 OTP for ${email}: ${code}\n`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("OTP send error:", error);
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 },
    );
  }
}
