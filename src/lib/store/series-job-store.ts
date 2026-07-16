"use client";

import { create } from "zustand";
import type { AiUsage } from "@/lib/ai/types";

export type SeriesStepStatus = "queued" | "running" | "done" | "failed";
export type CountryJobStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export interface SeriesStep {
  /** "route" | "itinerary:<editionId>" | "listing" | "images" */
  id: string;
  label: string;
  status: SeriesStepStatus;
  usage?: AiUsage;
  error?: string;
}

export interface CountryJob {
  country: string;
  productId?: string;
  status: CountryJobStatus;
  steps: SeriesStep[];
  error?: string;
}

export interface SeriesJob {
  seriesId: string;
  seriesName: string;
  sourceProductId: string;
  status: "running" | "done" | "cancelled";
  withImages: boolean;
  countries: CountryJob[];
}

interface SeriesJobState {
  /** In-memory only: on reload the board reconstructs from persisted drafts. */
  jobs: Record<string, SeriesJob>;
  startJob: (job: SeriesJob) => void;
  patchCountry: (
    seriesId: string,
    country: string,
    patch: Partial<CountryJob>,
  ) => void;
  patchStep: (
    seriesId: string,
    country: string,
    stepId: string,
    patch: Partial<SeriesStep>,
  ) => void;
  upsertStep: (seriesId: string, country: string, step: SeriesStep) => void;
  finishJob: (seriesId: string, status?: SeriesJob["status"]) => void;
  cancelJob: (seriesId: string) => void;
}

export const useSeriesJobStore = create<SeriesJobState>()((set) => ({
  jobs: {},

  startJob: (job) =>
    set((state) => ({ jobs: { ...state.jobs, [job.seriesId]: job } })),

  patchCountry: (seriesId, country, patch) =>
    set((state) => {
      const job = state.jobs[seriesId];
      if (!job) return state;
      return {
        jobs: {
          ...state.jobs,
          [seriesId]: {
            ...job,
            countries: job.countries.map((item) =>
              item.country === country ? { ...item, ...patch } : item,
            ),
          },
        },
      };
    }),

  patchStep: (seriesId, country, stepId, patch) =>
    set((state) => {
      const job = state.jobs[seriesId];
      if (!job) return state;
      return {
        jobs: {
          ...state.jobs,
          [seriesId]: {
            ...job,
            countries: job.countries.map((item) =>
              item.country === country
                ? {
                    ...item,
                    steps: item.steps.map((step) =>
                      step.id === stepId ? { ...step, ...patch } : step,
                    ),
                  }
                : item,
            ),
          },
        },
      };
    }),

  upsertStep: (seriesId, country, step) =>
    set((state) => {
      const job = state.jobs[seriesId];
      if (!job) return state;
      return {
        jobs: {
          ...state.jobs,
          [seriesId]: {
            ...job,
            countries: job.countries.map((item) => {
              if (item.country !== country) return item;
              const exists = item.steps.some((s) => s.id === step.id);
              return {
                ...item,
                steps: exists
                  ? item.steps.map((s) => (s.id === step.id ? step : s))
                  : [...item.steps, step],
              };
            }),
          },
        },
      };
    }),

  finishJob: (seriesId, status = "done") =>
    set((state) => {
      const job = state.jobs[seriesId];
      if (!job) return state;
      return {
        jobs: { ...state.jobs, [seriesId]: { ...job, status } },
      };
    }),

  cancelJob: (seriesId) =>
    set((state) => {
      const job = state.jobs[seriesId];
      if (!job) return state;
      return {
        jobs: {
          ...state.jobs,
          [seriesId]: {
            ...job,
            status: "cancelled",
            countries: job.countries.map((item) =>
              item.status === "queued" || item.status === "running"
                ? { ...item, status: "cancelled" }
                : item,
            ),
          },
        },
      };
    }),
}));
