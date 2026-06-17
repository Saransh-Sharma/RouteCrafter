"use client";

import { create as createZustand } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AI_PROVIDERS, AI_PROVIDER_IDS } from "@/lib/ai/providers";
import { isCloudPersistenceEnabled } from "@/lib/persistence/config";
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
  cloudHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  hydrateCloudPreferences: () => Promise<void>;
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
      cloudHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      hydrateCloudPreferences: async () => {
        if (!isCloudPersistenceEnabled()) {
          set({ cloudHydrated: true });
          return;
        }
        try {
          const response = await fetch("/api/preferences", {
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          if (!response.ok) {
            set({ cloudHydrated: true });
            return;
          }
          const body = await response.json();
          const preferences = body.preferences as
            | {
                aiDefaults?: { text?: AiTextDefaults; image?: AiImageDefaults };
                customModels?: Partial<
                  Record<
                    AiProviderId,
                    { customTextModel?: string; customImageModel?: string }
                  >
                >;
              }
            | undefined;
          if (!preferences) {
            set({ cloudHydrated: true });
            return;
          }
          set((state) => ({
            text: preferences.aiDefaults?.text ?? state.text,
            image: preferences.aiDefaults?.image ?? state.image,
            providers: mergeCustomModels(state.providers, preferences.customModels),
            cloudHydrated: true,
          }));
        } catch {
          set({ cloudHydrated: true });
        }
      },

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
        set((state) => {
          const next = {
            providers: {
              ...state.providers,
              [provider]: {
                ...state.providers[provider],
                [kind === "text" ? "customTextModel" : "customImageModel"]:
                  model.trim(),
              },
            },
          };
          void syncCloudPreferences({ ...state, ...next });
          return next;
        }),

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
        set((state) => {
          const next = {
            text: {
            ...state.text,
            ...patch,
            model:
              patch.provider && !patch.model
                ? AI_PROVIDERS[patch.provider].defaultTextModel
                : patch.model ?? state.text.model,
            },
          };
          void syncCloudPreferences({ ...state, ...next });
          return next;
        }),

      setImageDefaults: (patch) =>
        set((state) => {
          const next = {
            image: {
            ...state.image,
            ...patch,
            model:
              patch.provider && !patch.model
                ? AI_PROVIDERS[patch.provider].defaultImageModel
                : patch.model ?? state.image.model,
            },
          };
          void syncCloudPreferences({ ...state, ...next });
          return next;
        }),

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

function mergeCustomModels(
  providers: Record<AiProviderId, AiProviderSettings>,
  customModels:
    | Partial<
        Record<AiProviderId, { customTextModel?: string; customImageModel?: string }>
      >
    | undefined,
): Record<AiProviderId, AiProviderSettings> {
  if (!customModels) return providers;
  return AI_PROVIDER_IDS.reduce(
    (next, provider) => ({
      ...next,
      [provider]: {
        ...providers[provider],
        customTextModel:
          customModels[provider]?.customTextModel ??
          providers[provider].customTextModel,
        customImageModel:
          customModels[provider]?.customImageModel ??
          providers[provider].customImageModel,
      },
    }),
    providers,
  );
}

async function syncCloudPreferences(state: Pick<
  AiSettingsState,
  "text" | "image" | "providers"
>): Promise<void> {
  if (!isCloudPersistenceEnabled()) return;
  if (typeof fetch === "undefined") return;
  const customModels = AI_PROVIDER_IDS.reduce(
    (acc, provider) => ({
      ...acc,
      [provider]: {
        customTextModel: state.providers[provider].customTextModel,
        customImageModel: state.providers[provider].customImageModel,
      },
    }),
    {} as Record<
      AiProviderId,
      { customTextModel: string; customImageModel: string }
    >,
  );
  await fetch("/api/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      aiDefaults: { text: state.text, image: state.image },
      customModels,
      dismissedCoachMarks: [],
      libraryView: {},
    }),
  }).catch(() => undefined);
}
