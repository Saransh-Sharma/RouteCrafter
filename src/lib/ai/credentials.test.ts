// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AiConfigurationError,
  getPublicAiConfig,
  resolveImageCredential,
  resolveTextCredential,
} from "./credentials";

describe("AI credential resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses a personal key without changing the requested provider or model", () => {
    vi.stubEnv("OPEN_AI_KEY", "sk-server-secret");

    expect(
      resolveTextCredential({
        provider: "anthropic",
        apiKey: "sk-ant-personal",
        model: "claude-sonnet-4-6",
      }),
    ).toEqual({
      provider: "anthropic",
      apiKey: "sk-ant-personal",
      model: "claude-sonnet-4-6",
      credentialSource: "personal",
    });
  });

  it("falls back to the server key and forces the server text model", () => {
    vi.stubEnv("OPEN_AI_KEY", "sk-server-secret");

    expect(
      resolveTextCredential({
        provider: "gemini",
        model: "gemini-3.5-flash",
      }),
    ).toEqual({
      provider: "openai",
      apiKey: "sk-server-secret",
      model: "gpt-5.4",
      credentialSource: "server",
    });
  });

  it("falls back to the server key and forces the server image model", () => {
    vi.stubEnv("OPEN_AI_KEY", "sk-server-secret");

    expect(
      resolveImageCredential({
        provider: "gemini",
        model: "gemini-3.1-flash-image",
      }),
    ).toEqual({
      provider: "openai",
      apiKey: "sk-server-secret",
      model: "gpt-image-2",
      credentialSource: "server",
    });
  });

  it("throws a service-unavailable error when no key is available", () => {
    vi.stubEnv("OPEN_AI_KEY", "");

    expect(() =>
      resolveTextCredential({ provider: "openai", model: "gpt-5.4" }),
    ).toThrowError(AiConfigurationError);
    expect(() =>
      resolveTextCredential({ provider: "openai", model: "gpt-5.4" }),
    ).toThrow("No AI credential is available");
  });

  it("returns only non-secret server configuration metadata", () => {
    vi.stubEnv("OPEN_AI_KEY", "sk-server-secret");

    const config = getPublicAiConfig();

    expect(config).toEqual({
      serverOpenAiAvailable: true,
      serverTextModel: "gpt-5.4",
      serverImageModel: "gpt-image-2",
    });
    expect(JSON.stringify(config)).not.toContain("sk-server-secret");
  });
});
