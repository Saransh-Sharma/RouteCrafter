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
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;

export const otpRequestSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export type OtpRequest = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "OTP must be 6 digits"),
});

export type OtpVerify = z.infer<typeof otpVerifySchema>;

export const sessionPayloadSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  role: userRoleEnum,
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;
