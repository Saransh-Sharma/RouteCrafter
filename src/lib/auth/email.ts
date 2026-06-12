import { Resend } from "resend";
import type { User } from "../schemas/auth";
import { readOtpEmailConfig } from "./config";

export async function sendOtpEmail(user: User, code: string): Promise<void> {
  const config = readOtpEmailConfig();
  if (!config) {
    console.info(`RouteCrafter OTP for ${user.username}: ${code}`);
    return;
  }

  const resend = new Resend(config.apiKey);
  const result = await resend.emails.send({
    from: config.from,
    to: user.email,
    subject: "Your RouteCrafter login code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #344e3c; font-size: 24px; margin-bottom: 8px;">RouteCrafter</h2>
        <p style="color: #58534a; font-size: 14px; margin-bottom: 24px;">
          Hi ${user.displayName}, here is your login code:
        </p>
        <div style="background: #f6f1e7; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2c2a24;">
            ${code}
          </span>
        </div>
        <p style="color: #8a8273; font-size: 12px;">
          This code expires in 5 minutes. If you did not request this, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (result.error) throw new Error(result.error.message);
}
