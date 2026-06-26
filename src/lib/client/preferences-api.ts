import type {
  AiImageDefaults,
  AiProviderId,
  AiTextDefaults,
} from "@/lib/ai/types";
import { requestJson, type ClientApiResult, requestJsonResult } from "./http";

export interface UserPreferences {
  aiDefaults: { text?: AiTextDefaults; image?: AiImageDefaults };
  customModels: Partial<
    Record<AiProviderId, { customTextModel?: string; customImageModel?: string }>
  >;
  dismissedCoachMarks: unknown;
  libraryView: unknown;
  updatedAt?: string;
}

export interface PreferencesPayload {
  aiDefaults: { text: AiTextDefaults; image: AiImageDefaults };
  customModels: Record<
    AiProviderId,
    { customTextModel: string; customImageModel: string }
  >;
  dismissedCoachMarks: unknown[];
  libraryView: Record<string, unknown>;
}

export type PreferencesResult<T> = ClientApiResult<T>;

export function getPreferences(): Promise<
  PreferencesResult<{ preferences?: UserPreferences | null }>
> {
  return requestJsonResult("/api/preferences");
}

export function putPreferences(
  payload: PreferencesPayload,
): Promise<{ preferences?: UserPreferences }> {
  return requestJson(
    "/api/preferences",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Could not save preferences.",
  );
}
