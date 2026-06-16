// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as textPost } from "./text/route";
import { POST as imagePost } from "./image/route";
import { GET as configGet } from "./config/route";
import { signToken } from "@/lib/auth/jwt";

describe("AI route authentication", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "ai-route-test-secret-long-enough");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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
    const request = await authenticatedRequest("/api/ai/text", {});

    expect((await textPost(request)).status).toBe(400);
  });

  it("protects server AI configuration metadata", async () => {
    vi.stubEnv("OPEN_AI_KEY", "sk-server-secret");
    const missing = await configGet(
      new NextRequest("http://localhost/api/ai/config"),
    );
    const valid = await configGet(
      await authenticatedRequest("/api/ai/config", undefined, "GET"),
    );

    expect(missing.status).toBe(401);
    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual({
      serverOpenAiAvailable: true,
      serverTextModel: "gpt-5.4",
      serverImageModel: "gpt-image-2",
    });
  });

  it("uses the server key and forced OpenAI model when no personal key is sent", async () => {
    vi.stubEnv("OPEN_AI_KEY", "sk-server-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        output_text: "Server-funded result",
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await textPost(
      await authenticatedRequest("/api/ai/text", {
        provider: "gemini",
        model: "gemini-3.5-flash",
        prompt: "Hello",
        taskType: "prompt",
        maxOutputTokens: 100,
      }),
    );
    const result = await response.json();
    const upstream = fetchMock.mock.calls[0];
    const upstreamBody = JSON.parse(String(upstream[1]?.body));

    expect(response.status).toBe(200);
    expect(upstream[0]).toBe("https://api.openai.com/v1/responses");
    expect(upstream[1]?.headers).toMatchObject({
      Authorization: "Bearer sk-server-secret",
    });
    expect(upstreamBody.model).toBe("gpt-5.4");
    expect(result).toMatchObject({
      provider: "openai",
      model: "gpt-5.4",
      credentialSource: "server",
    });
    expect(JSON.stringify(result)).not.toContain("sk-server-secret");
  });

  it("prefers a personal provider key over the server credential", async () => {
    vi.stubEnv("OPEN_AI_KEY", "sk-server-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        content: [{ type: "text", text: "Personal result" }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await textPost(
      await authenticatedRequest("/api/ai/text", {
        provider: "anthropic",
        apiKey: "sk-ant-personal",
        model: "claude-sonnet-4-6",
        prompt: "Hello",
        taskType: "prompt",
        maxOutputTokens: 100,
      }),
    );
    const result = await response.json();
    const upstream = fetchMock.mock.calls[0];

    expect(response.status).toBe(200);
    expect(upstream[0]).toBe("https://api.anthropic.com/v1/messages");
    expect(upstream[1]?.headers).toMatchObject({
      "x-api-key": "sk-ant-personal",
    });
    expect(result).toMatchObject({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      credentialSource: "personal",
    });
  });

  it("returns 503 when neither server nor personal credentials exist", async () => {
    vi.stubEnv("OPEN_AI_KEY", "");

    const response = await textPost(
      await authenticatedRequest("/api/ai/text", {
        provider: "openai",
        model: "gpt-5.4",
        prompt: "Hello",
        taskType: "prompt",
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error:
        "No AI credential is available. Add a personal key or configure OPEN_AI_KEY on the server.",
    });
  });

  it("returns a specific error when OpenAI stops at the token limit", async () => {
    vi.stubEnv("OPEN_AI_KEY", "sk-server-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output_text: '{"days":[{"day":1,"title":"Arrival"',
        }),
      ),
    );

    const response = await textPost(
      await authenticatedRequest("/api/ai/text", {
        provider: "openai",
        model: "gpt-5.4",
        prompt: "Draft a long itinerary",
        taskType: "itinerary",
        maxOutputTokens: 4000,
        responseFormat: "json",
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "The model stopped before finishing the JSON response. Try again with a shorter itinerary or a higher output-token limit.",
    });
  });

  it("rejects JSON responses that look cut off without a finish reason", async () => {
    vi.stubEnv("OPEN_AI_KEY", "sk-server-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          output_text:
            '{"days":[{"day":7,"evening":"Transfer to the airport if time',
        }),
      ),
    );

    const response = await textPost(
      await authenticatedRequest("/api/ai/text", {
        provider: "openai",
        model: "gpt-5.4",
        prompt: "Draft a long itinerary",
        taskType: "itinerary",
        maxOutputTokens: 4000,
        responseFormat: "json",
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "The model stopped before finishing the JSON response. Try again with a shorter itinerary or a higher output-token limit.",
    });
  });

  it("returns an error when the upstream provider request times out", async () => {
    vi.stubEnv("OPEN_AI_KEY", "sk-server-secret");
    vi.stubEnv("AI_PROVIDER_TIMEOUT_MS", "1");
    const request = await authenticatedRequest("/api/ai/text", {
      provider: "openai",
      model: "gpt-5.4",
      prompt: "Draft a long itinerary",
      taskType: "itinerary",
      maxOutputTokens: 4000,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      ),
    );

    const response = await textPost(request);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "The provider request timed out. Try again or reduce the request size.",
    });
  });
});

async function authenticatedRequest(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<NextRequest> {
  const token = await signToken({
    userId: "user_admin",
    username: "admin",
    displayName: "Admin",
    role: "admin",
  });
  const request = new NextRequest(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
  });
  request.cookies.set("rc-session", token);
  return request;
}
