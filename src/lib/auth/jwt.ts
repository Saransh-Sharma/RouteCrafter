import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import {
  sessionPayloadSchema,
  type SessionPayload,
} from "../schemas/auth";
import { requireAuthSecret } from "./config";

const ALGORITHM = "HS256";
const SESSION_DURATION = "7d";
const ISSUER = "routecrafter";
const AUDIENCE = "routecrafter-web";

function getSecret(): Uint8Array {
  return new TextEncoder().encode(requireAuthSecret());
}

type SessionClaims = Omit<SessionPayload, "iat" | "exp">;

export async function signToken(payload: SessionClaims): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecret());
}

export async function verifyToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return parseSessionPayload(payload);
  } catch {
    return null;
  }
}

function parseSessionPayload(payload: JWTPayload): SessionPayload | null {
  const parsed = sessionPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
