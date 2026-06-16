"use client";

import { create as createZustand } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AI_PROVIDERS, AI_PROVIDER_IDS } from "@/lib/ai/providers";
import type {
  AiImageDefaults,
  AiProviderId,
  AiProviderSettings,
  AiTextDefaults,
} from "@/lib/ai/types";

const emptyProviderSettings = (): AiProviderSettings => ({
  apiKey: "",
  customTextModel: "",
  customImageModel: "",
});

const defaultProviders = () =>
  AI_PROVIDER_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: emptyProviderSettings() }),
    {} as Record<AiProviderId, AiProviderSettings>,
  );

const LEGACY_OPENAI_TEXT_MODELS = new Set(["gpt-5.2"]);
const LEGACY_OPENAI_IMAGE_MODELS = new Set(["gpt-image-1"]);

export function migratePersistedAiSettings<T extends {
  text?: AiTextDefaults;
  image?: AiImageDefaults;
}>(persisted: T): T {
  return {
    ...persisted,
    text: persisted.text
      ? {
          ...persisted.text,
          model:
            persisted.text.provider === "openai" &&
            LEGACY_OPENAI_TEXT_MODELS.has(persisted.text.model)
              ? AI_PROVIDERS.openai.defaultTextModel
              : persisted.text.model,
        }
      : persisted.text,
    image: persisted.image
      ? {
          ...persisted.image,
          model:
            persisted.image.provider === "openai" &&
            LEGACY_OPENAI_IMAGE_MODELS.has(persisted.image.model)
              ? AI_PROVIDERS.openai.defaultImageModel
              : persisted.image.model,
        }
      : persisted.image,
  };
}

export interface AiSettingsState {
  providers: Record<AiProviderId, AiProviderSettings>;
  text: AiTextDefaults;
  image: AiImageDefaults;
  requirePreviewBeforeApply: true;
  showBillableConfirmation: true;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setProviderKey: (provider: AiProviderId, apiKey: string) => void;
  removeProviderKey: (provider: AiProviderId) => void;
  setProviderCustomModel: (
    provider: AiProviderId,
    kind: "text" | "image",
    model: string,
  ) => void;
  setProviderTestResult: (
    provider: AiProviderId,
    result: { status: "ok" | "error"; message: string },
  ) => void;
  setTextDefaults: (patch: Partial<AiTextDefaults>) => void;
  setImageDefaults: (patch: Partial<AiImageDefaults>) => void;
  getApiKey: (provider: AiProviderId) => string;
  hasAnyKey: () => boolean;
  hasKeyFor: (provider: AiProviderId) => boolean;
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return "Saved key";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function configuredProviders(
  providers: Record<AiProviderId, AiProviderSettings>,
): AiProviderId[] {
  return AI_PROVIDER_IDS.filter((id) => Boolean(providers[id]?.apiKey));
}

export const useAiSettingsStore = createZustand<AiSettingsState>()(
  persist(
    (set, get) => ({
      providers: defaultProviders(),
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
      hasHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      setProviderKey: (provider, apiKey) =>
        set((state) => ({
          providers: {
            ...state.providers,
            [provider]: {
              ...state.providers[provider],
              apiKey: apiKey.trim(),
              lastTestStatus: undefined,
              lastTestMessage: undefined,
            },
          },
        })),

      removeProviderKey: (provider) =>
        set((state) => ({
          providers: {
            ...state.providers,
            [provider]: {
              ...state.providers[provider],
              apiKey: "",
              lastTestStatus: undefined,
              lastTestMessage: undefined,
              lastTestedAt: undefined,
            },
          },
        })),

      setProviderCustomModel: (provider, kind, model) =>
        set((state) => ({
          providers: {
            ...state.providers,
            [provider]: {
              ...state.providers[provider],
              [kind === "text" ? "customTextModel" : "customImageModel"]:
                model.trim(),
            },
          },
        })),

      setProviderTestResult: (provider, result) =>
        set((state) => ({
          providers: {
            ...state.providers,
            [provider]: {
              ...state.providers[provider],
              lastTestedAt: new Date().toISOString(),
              lastTestStatus: result.status,
              lastTestMessage: result.message,
            },
          },
        })),

      setTextDefaults: (patch) =>
        set((state) => ({
          text: {
            ...state.text,
            ...patch,
            model:
              patch.provider && !patch.model
                ? AI_PROVIDERS[patch.provider].defaultTextModel
                : patch.model ?? state.text.model,
          },
        })),

      setImageDefaults: (patch) =>
        set((state) => ({
          image: {
            ...state.image,
            ...patch,
            model:
              patch.provider && !patch.model
                ? AI_PROVIDERS[patch.provider].defaultImageModel
                : patch.model ?? state.image.model,
          },
        })),

      getApiKey: (provider) => get().providers[provider]?.apiKey ?? "",
      hasAnyKey: () => configuredProviders(get().providers).length > 0,
      hasKeyFor: (provider) => Boolean(get().providers[provider]?.apiKey),
    }),
    {
      name: "routecrafter:ai-settings:v1",
      version: 2,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        providers: state.providers,
        text: state.text,
        image: state.image,
        requirePreviewBeforeApply: state.requirePreviewBeforeApply,
        showBillableConfirmation: state.showBillableConfirmation,
      }),
      migrate: (persisted) =>
        migratePersistedAiSettings(
          persisted as Partial<AiSettingsState>,
        ) as AiSettingsState,
      merge: (persisted, current) => ({
        ...current,
        ...migratePersistedAiSettings(
          persisted as Partial<AiSettingsState>,
        ),
        providers: {
          ...defaultProviders(),
          ...((persisted as Partial<AiSettingsState>)?.providers ?? {}),
        },
        requirePreviewBeforeApply: true,
        showBillableConfirmation: true,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
