import { z } from "zod";

export const userRoleEnum = z.enum(["admin", "editor"]);
export type UserRole = z.infer<typeof userRoleEnum>;

export const userSchema = z.object({
  id: z.string(),
  username: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email(),
  role: userRoleEnum,
});

export type User = z.infer<typeof userSchema>;

export const loginCredentialsSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(64),
  password: z.string().min(1, "Password is required"),
});

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;

export const otpRequestSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(64),
});

export type OtpRequest = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(64),
  code: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export type OtpVerify = z.infer<typeof otpVerifySchema>;

export const sessionPayloadSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  role: userRoleEnum,
  iat: z.number(),
  exp: z.number(),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;
