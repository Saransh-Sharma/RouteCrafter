import { z } from "zod";
import type { AiResult, AiTaskType } from "@/lib/ai/types";
import type { Project } from "@/lib/types";
import { activityActionEnum } from "@/lib/schemas/activity";

export interface CloudProject {
  project: Project;
  revision: number;
}

export interface ProjectMutationRequest {
  project: Project;
  expectedRevision?: number;
  activityDetail?: string;
}

export const assetTypeSchema = z.enum([
  "cover-image",
  "day-image",
  "portfolio-visual",
  "pdf",
  "json-export",
  "markdown-export",
  "csv-export",
]);

export const assetSourceSchema = z.enum([
  "upload",
  "ai-generation",
  "pdf-export",
  "manual-export",
]);

export const assetUsageTypeSchema = z.enum([
  "itinerary-cover",
  "itinerary-day",
  "portfolio-visual",
  "export",
]);

export type AssetType = z.infer<typeof assetTypeSchema>;
export type AssetSource = z.infer<typeof assetSourceSchema>;
export type AssetUsageType = z.infer<typeof assetUsageTypeSchema>;

export interface AssetDTO {
  id: string;
  projectId: string;
  country: string;
  editionLabel?: string | null;
  assetType: AssetType;
  source: AssetSource;
  filename: string;
  mimeType: string;
  sizeBytes?: number | null;
  blobUrl: string;
  blobPathname: string;
  width?: number | null;
  height?: number | null;
  createdAt: string;
  usages?: AssetUsageDTO[];
}

export interface AssetUsageDTO {
  id: string;
  assetId: string;
  projectId: string;
  usageType: AssetUsageType;
  entityId?: string | null;
  fieldPath: string;
  createdAt: string;
}

export const activityCreateSchema = z.object({
  action: activityActionEnum,
  detail: z.string().default(""),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  clientEventId: z.string().min(1).optional(),
  metadata: z.unknown().optional(),
});

export const projectMutationSchema = z.object({
  project: z.unknown(),
  expectedRevision: z.number().int().positive().optional(),
  activityDetail: z.string().optional(),
});

export const preferencePayloadSchema = z.object({
  aiDefaults: z.unknown(),
  customModels: z.unknown(),
  dismissedCoachMarks: z.unknown(),
  libraryView: z.unknown(),
});

export interface AiRunResult extends AiResult {
  aiRunId?: string;
}

export interface ApplyAiRunInput {
  projectId?: string;
  projectRevision?: number;
  assetId?: string;
  label?: string;
  source?: string;
  taskType?: AiTaskType;
}
