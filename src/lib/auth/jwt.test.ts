// @vitest-environment node

import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signToken, verifyToken } from "./jwt";

const secret = "test-secret-that-is-long-enough-for-auth";

describe("JWT sessions", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", secret);
  });

  it("signs and verifies a valid session", async () => {
    const token = await signToken({
      userId: "user_saransh",
      username: "saransh",
      displayName: "Saransh",
      role: "editor",
    });

    await expect(verifyToken(token)).resolves.toMatchObject({
      userId: "user_saransh",
      username: "saransh",
      role: "editor",
    });
  });

  it("rejects tampered tokens", async () => {
    const token = await signToken({
      userId: "user_admin",
      username: "admin",
      displayName: "Admin",
      role: "admin",
    });
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    await expect(verifyToken(tampered)).resolves.toBeNull();
  });

  it("rejects expired and incorrectly scoped tokens", async () => {
    const key = new TextEncoder().encode(secret);
    const expired = await new SignJWT({
      userId: "user_admin",
      username: "admin",
      displayName: "Admin",
      role: "admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("routecrafter")
      .setAudience("routecrafter-web")
      .setIssuedAt()
      .setExpirationTime("0s")
      .sign(key);
    const wrongAudience = await new SignJWT({
      userId: "user_admin",
      username: "admin",
      displayName: "Admin",
      role: "admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("routecrafter")
      .setAudience("another-app")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);

    await expect(verifyToken(expired)).resolves.toBeNull();
    await expect(verifyToken(wrongAudience)).resolves.toBeNull();
  });
});
