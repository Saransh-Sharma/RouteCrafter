// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateImage,
  generateText,
  safeParseSseJson,
  streamGenerateText,
} from "./provider-adapters";
import { AI_ERROR } from "./errors";

const imageRequest = {
  provider: "openai" as const,
  apiKey: "sk-test",
  model: "gpt-image-2",
  prompt: "Premium itinerary cover",
  taskType: "imageGeneration" as const,
  credentialSource: "server" as const,
};

const textRequest = {
  provider: "openai" as const,
  apiKey: "sk-test",
  model: "gpt-5.4",
  prompt: "Draft listing copy",
  taskType: "listing" as const,
  credentialSource: "server" as const,
};

describe("provider fetch retries", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("retries transient 500 responses before succeeding", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "down" } }), {
          status: 500,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: [{ b64_json: "YWJj" }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = generateImage(imageRequest);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.image).toBe("data:image/png;base64,YWJj");
    expect(result.providerAttempts).toBe(2);
  });

  it("retries HTTP 429 before succeeding", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(
        Response.json({ data: [{ b64_json: "eXk=" }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = generateImage(imageRequest);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.providerAttempts).toBe(2);
  });

  it("does not retry provider authentication failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "invalid key" } }), {
        status: 401,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateImage(imageRequest)).rejects.toThrow(
      AI_ERROR.AUTH_FAILED,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries provider timeouts before succeeding", async () => {
    vi.useFakeTimers();
    vi.stubEnv("AI_PROVIDER_TIMEOUT_MS", "1");
    let attempts = 0;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      attempts += 1;
      if (attempts === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      }
      return Promise.resolve(Response.json({ data: [{ b64_json: "ZGVm" }] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = generateImage(imageRequest);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.image).toBe("data:image/png;base64,ZGVm");
  });

  it("throws after exhausted retries", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "down" } }), {
        status: 500,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = generateImage(imageRequest);
    const expectation = expect(resultPromise).rejects.toThrow(
      AI_ERROR.PROVIDER_UNAVAILABLE,
    );
    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry unknown thrown values", async () => {
    const fetchMock = vi.fn().mockRejectedValue("broken");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateImage(imageRequest)).rejects.toThrow(
      AI_ERROR.DID_NOT_COMPLETE,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries text generation after a transient 500", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        Response.json({
          output_text: "Listing copy",
          usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = generateText(textRequest);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).toBe("Listing copy");
    expect(result.providerAttempts).toBe(2);
  });

  it("reports streaming provider attempts after a transient OpenAI failure", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "response.output_text.delta",
            delta: "Hello",
          },
          {
            type: "response.completed",
            response: {
              usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
            },
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = collectStreamResult(streamGenerateText(textRequest));
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).toBe("Hello");
    expect(result.providerAttempts).toBe(2);
  });

  it("throws a normalized streaming error for malformed OpenAI SSE JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("data: {not-json}\n\n", {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    await expect(
      collectStreamResult(streamGenerateText(textRequest)),
    ).rejects.toThrow("OpenAI returned a malformed streaming event.");
  });

  it("throws when a provider stream ends before completion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([{ type: "response.output_text.delta", delta: "Partial" }]),
      ),
    );

    await expect(
      collectStreamResult(streamGenerateText(textRequest)),
    ).rejects.toThrow("Provider stream ended before completion.");
  });

  it("does not retry streaming requests after a user abort", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      collectStreamResult(streamGenerateText(textRequest, controller.signal)),
    ).rejects.toThrow("Aborted");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses valid SSE JSON and reports invalid JSON without throwing", () => {
    expect(safeParseSseJson('{"ok":true}')).toEqual({
      ok: true,
      value: { ok: true },
    });
    expect(safeParseSseJson("{broken").ok).toBe(false);
  });
});

function sseResponse(events: unknown[]): Response {
  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

async function collectStreamResult(
  stream: AsyncGenerator<
    { type: "delta"; text: string } | { type: "result"; result: Awaited<ReturnType<typeof generateText>> }
  >,
): Promise<Awaited<ReturnType<typeof generateText>>> {
  let result: Awaited<ReturnType<typeof generateText>> | undefined;
  for await (const event of stream) {
    if (event.type === "result") result = event.result;
  }
  if (!result) throw new Error("No stream result.");
  return result;
}
