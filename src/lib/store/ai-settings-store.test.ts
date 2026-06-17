import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import {
  maskApiKey,
  migratePersistedAiSettings,
  useAiSettingsStore,
} from "./ai-settings-store";

describe("AI settings store", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ preferences: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    useAiSettingsStore.setState({
      providers: {
        openai: { apiKey: "", customTextModel: "", customImageModel: "" },
        anthropic: { apiKey: "", customTextModel: "", customImageModel: "" },
        gemini: { apiKey: "", customTextModel: "", customImageModel: "" },
      },
      text: {
        provider: "openai",
        model: AI_PROVIDERS.openai.defaultTextModel,
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4000,
      },
      image: {
        provider: "openai",
        model: AI_PROVIDERS.openai.defaultImageModel,
        size: "1024x1024",
        quality: "medium",
        aspectRatio: "1:1",
      },
      requirePreviewBeforeApply: true,
      showBillableConfirmation: true,
      hasHydrated: true,
    });
  });

  it("persists provider keys in browser storage and masks display values", () => {
    useAiSettingsStore
      .getState()
      .setProviderKey("openai", "sk-test-routecrafter-1234");

    expect(useAiSettingsStore.getState().hasKeyFor("openai")).toBe(true);
    expect(maskApiKey(useAiSettingsStore.getState().getApiKey("openai"))).toBe(
      "sk-t...1234",
    );
    expect(localStorage.getItem("routecrafter:ai-settings:v1")).toContain(
      "sk-test-routecrafter-1234",
    );
  });

  it("removes provider keys without clearing custom model defaults", () => {
    const store = useAiSettingsStore.getState();
    store.setProviderKey("gemini", "AIza-test");
    store.setProviderCustomModel("gemini", "text", "gemini-custom");
    store.removeProviderKey("gemini");

    expect(useAiSettingsStore.getState().hasKeyFor("gemini")).toBe(false);
    expect(
      useAiSettingsStore.getState().providers.gemini.customTextModel,
    ).toBe("gemini-custom");
  });

  it("migrates legacy OpenAI defaults without overwriting custom selections", () => {
    const migrated = migratePersistedAiSettings({
      text: {
        provider: "openai",
        model: "gpt-5.2",
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4000,
      },
      image: {
        provider: "openai",
        model: "gpt-image-1",
        size: "1024x1024",
        quality: "medium",
        aspectRatio: "1:1",
      },
    });
    const custom = migratePersistedAiSettings({
      text: {
        provider: "openai",
        model: "gpt-custom",
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4000,
      },
      image: {
        provider: "openai",
        model: "gpt-image-custom",
        size: "1024x1024",
        quality: "medium",
        aspectRatio: "1:1",
      },
    });

    expect(migrated.text?.model).toBe("gpt-5.4");
    expect(migrated.image?.model).toBe("gpt-image-2");
    expect(custom.text?.model).toBe("gpt-custom");
    expect(custom.image?.model).toBe("gpt-image-custom");
  });

  it("syncs cloud preferences without provider API keys", () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const fetchMock = vi.fn(
      async (...args: [string | URL | Request, RequestInit?]) => {
        void args;
        return new Response("{}", { status: 200 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const store = useAiSettingsStore.getState();
    store.setProviderKey("openai", "sk-secret");
    store.setProviderCustomModel("openai", "text", "gpt-custom");

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(JSON.stringify(body)).not.toContain("sk-secret");
    expect(body.customModels.openai.customTextModel).toBe("gpt-custom");
  });
});
