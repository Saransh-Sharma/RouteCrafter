import { beforeEach, describe, expect, it } from "vitest";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import {
  maskApiKey,
  useAiSettingsStore,
} from "./ai-settings-store";

describe("AI settings store", () => {
  beforeEach(() => {
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
});
