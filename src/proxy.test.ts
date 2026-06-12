// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { config, proxy } from "./proxy";
import { signToken } from "@/lib/auth/jwt";

describe("authentication proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "proxy-test-secret-long-enough");
  });

  it("matches protected pages and APIs but excludes static assets", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "/projects",
      }),
    ).toBe(true);
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "/_next/static/chunk.js",
      }),
    ).toBe(false);
  });

  it("redirects pages with the complete return path", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/projects/123?tab=pdf"),
    );

    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(
      "http://localhost/login?redirect=%2Fprojects%2F123%3Ftab%3Dpdf",
    );
  });

  it("returns JSON 401 for missing or forged API sessions", async () => {
    const missing = await proxy(
      new NextRequest("http://localhost/api/ai/text"),
    );
    const forgedRequest = new NextRequest("http://localhost/api/ai/text");
    forgedRequest.cookies.set("rc-session", "not-a-jwt");
    const forged = await proxy(forgedRequest);

    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ error: "Unauthorized" });
    expect(forged.status).toBe(401);
  });

  it("allows protected requests with a valid signed session", async () => {
    const token = await signToken({
      userId: "user_admin",
      username: "admin",
      displayName: "Admin",
      role: "admin",
    });
    const request = new NextRequest("http://localhost/projects");
    request.cookies.set("rc-session", token);

    expect((await proxy(request)).status).toBe(200);
  });
});
