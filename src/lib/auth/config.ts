export class AuthConfigurationError extends Error {
  constructor(
    message: string,
    readonly variables: string[],
  ) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

export const USER_PASSWORD_ENV_MAP: Record<string, string> = {
  admin: "USER_ADMIN_PASSWORD",
  saransh: "USER_SARANSH_PASSWORD",
  saumya: "USER_SAUMYA_PASSWORD",
};

export function isAuthConfigurationError(
  error: unknown,
): error is AuthConfigurationError {
  return error instanceof AuthConfigurationError;
}

export function requireAuthSecret(): string {
  return requireEnv("NEXTAUTH_SECRET", "JWT sessions and OTP hashing");
}

export function readUserPassword(username: string): string | null {
  const normalized = username.trim().toLowerCase();
  const envKey = USER_PASSWORD_ENV_MAP[normalized];
  if (!envKey) return null;

  const password = process.env[envKey];
  if (password) return password;

  if (isProduction()) {
    throw new AuthConfigurationError(
      `Missing ${envKey}; password sign-in is not configured for user "${normalized}".`,
      [envKey],
    );
  }

  return null;
}

export function readRedisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { url, token };

  if (isProduction()) {
    throw missingEnvError(
      ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      "Redis-backed auth rate limiting and OTP storage",
    );
  }

  return null;
}

export function readOtpEmailConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (apiKey && from) return { apiKey, from };

  if (isProduction()) {
    throw missingEnvError(
      ["RESEND_API_KEY", "AUTH_EMAIL_FROM"],
      "Email OTP delivery",
    );
  }

  return null;
}

function requireEnv(name: string, purpose: string): string {
  const value = process.env[name];
  if (value) return value;
  throw missingEnvError([name], purpose);
}

function missingEnvError(names: string[], purpose: string): AuthConfigurationError {
  const missing = names.filter((name) => !process.env[name]);
  return new AuthConfigurationError(
    `Missing auth environment variable${
      missing.length === 1 ? "" : "s"
    } for ${purpose}: ${missing.join(", ")}`,
    missing,
  );
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
