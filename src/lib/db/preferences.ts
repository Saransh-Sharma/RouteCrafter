import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { userPreferences } from "./schema";

export interface UserPreferenceDTO {
  aiDefaults: unknown;
  customModels: unknown;
  dismissedCoachMarks: unknown;
  libraryView: unknown;
  updatedAt: string;
}

const DEFAULT_PREFERENCES: Omit<UserPreferenceDTO, "updatedAt"> = {
  aiDefaults: {},
  customModels: {},
  dismissedCoachMarks: [],
  libraryView: {},
};

export async function getPreferences(userId: string): Promise<UserPreferenceDTO> {
  const row = await getDb().query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  if (!row) {
    return { ...DEFAULT_PREFERENCES, updatedAt: new Date(0).toISOString() };
  }
  return {
    aiDefaults: row.aiDefaults,
    customModels: row.customModels,
    dismissedCoachMarks: row.dismissedCoachMarks,
    libraryView: row.libraryView,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertPreferences({
  userId,
  aiDefaults,
  customModels,
  dismissedCoachMarks,
  libraryView,
}: {
  userId: string;
  aiDefaults: unknown;
  customModels: unknown;
  dismissedCoachMarks: unknown;
  libraryView: unknown;
}): Promise<UserPreferenceDTO> {
  const updatedAt = new Date();
  await getDb()
    .insert(userPreferences)
    .values({
      userId,
      aiDefaults,
      customModels,
      dismissedCoachMarks,
      libraryView,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        aiDefaults,
        customModels,
        dismissedCoachMarks,
        libraryView,
        updatedAt,
      },
    });
  return {
    aiDefaults,
    customModels,
    dismissedCoachMarks,
    libraryView,
    updatedAt: updatedAt.toISOString(),
  };
}
