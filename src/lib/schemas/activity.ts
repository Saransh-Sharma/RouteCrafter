import { z } from "zod";

export const activityActionEnum = z.enum([
  "created",
  "updated",
  "deleted",
  "duplicated",
  "imported",
  "status_changed",
  "itinerary_updated",
  "config_updated",
  "listing_updated",
  "image_prompts_updated",
]);

export type ActivityAction = z.infer<typeof activityActionEnum>;

export const activityLogEntrySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
  userName: z.string(),
  action: activityActionEnum,
  detail: z.string().default(""),
  timestamp: z.string(),
});

export type ActivityLogEntry = z.infer<typeof activityLogEntrySchema>;
