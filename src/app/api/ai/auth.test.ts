// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as textPost } from "./text/route";
import { POST as imagePost } from "./image/route";
import { signToken } from "@/lib/auth/jwt";

describe("AI route authentication", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "ai-route-test-secret-long-enough");
  });

  it.each([
    ["text", textPost],
    ["image", imagePost],
  ])("rejects missing and forged sessions on the %s route", async (_, post) => {
    const missing = await post(
      new NextRequest(`http://localhost/api/ai/${String(_)}`, {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const forgedRequest = new NextRequest(
      `http://localhost/api/ai/${String(_)}`,
      {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      },
    );
    forgedRequest.cookies.set("rc-session", "not-a-jwt");
    const forged = await post(forgedRequest);

    expect(missing.status).toBe(401);
    expect(forged.status).toBe(401);
  });

  it("allows a valid session to reach request validation", async () => {
    const token = await signToken({
      userId: "user_admin",
      username: "admin",
      displayName: "Admin",
      role: "admin",
    });
    const request = new NextRequest("http://localhost/api/ai/text", {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    });
    request.cookies.set("rc-session", token);

    expect((await textPost(request)).status).toBe(400);
  });
});
