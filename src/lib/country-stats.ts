/**
 * Shared aggregation for grouping projects by destination country and deriving
 * the world-map choropleth fill. Used by the dashboard explorer, the top
 * countries rail, and the /countries catalog page so the math lives in one
 * place. All functions are pure and SSR-safe (memoize at the call site).
 */
import type { Project } from "@/lib/types";
import { getProjectWorkflow } from "@/lib/workflow";
import { countryNameToIso } from "@/lib/country-geo";

const FINISHED_STATUS: Project["status"] = "Ready to sell";

export interface CountryGroup {
  /** Display name, taken from the first project's `country` value. */
  country: string;
  /** ISO 3166-1 alpha-2 (uppercase) if the name could be resolved. */
  iso?: string;
  /** Projects with status "Ready to sell". */
  finished: Project[];
  /** Projects still in "Draft" or "In progress". */
  inProgress: Project[];
  total: number;
  /** finished / total — drives the green vs amber blend. */
  greenRatio: number;
  /** Mean getProjectWorkflow().progress across all projects (0-100). */
  avgCompletion: number;
  /** Most recent updatedAt across the group's projects (ISO string). */
  lastActivity: string;
}

function isFinished(project: Project): boolean {
  return project.status === FINISHED_STATUS;
}

/**
 * Group projects by country. Countries are keyed case-insensitively on the
 * trimmed `country` field; projects without a country are skipped.
 */
export function groupProjectsByCountry(projects: Project[]): CountryGroup[] {
  const buckets = new Map<string, Project[]>();

  for (const project of projects) {
    const country = project.country?.trim();
    if (!country) continue;
    const key = country.toLowerCase();
    const bucket = buckets.get(key);
    if (bucket) bucket.push(project);
    else buckets.set(key, [project]);
  }

  const groups: CountryGroup[] = [];
  for (const bucket of buckets.values()) {
    const country = bucket[0].country.trim();
    const finished = bucket.filter(isFinished);
    const inProgress = bucket.filter((p) => !isFinished(p));
    const total = bucket.length;
    const completionSum = bucket.reduce(
      (sum, project) => sum + getProjectWorkflow(project).progress,
      0,
    );
    const lastActivity = bucket.reduce(
      (latest, project) =>
        project.updatedAt > latest ? project.updatedAt : latest,
      bucket[0].updatedAt,
    );

    groups.push({
      country,
      iso: countryNameToIso(country),
      finished,
      inProgress,
      total,
      greenRatio: total > 0 ? finished.length / total : 0,
      avgCompletion: total > 0 ? Math.round(completionSum / total) : 0,
      lastActivity,
    });
  }

  return groups;
}

/** Sort by most recent activity (descending) — default for the dashboard. */
export function sortByActivity(groups: CountryGroup[]): CountryGroup[] {
  return [...groups].sort((a, b) => {
    if (a.lastActivity !== b.lastActivity) {
      return b.lastActivity.localeCompare(a.lastActivity);
    }
    return a.country.localeCompare(b.country);
  });
}

/**
 * Sort most-completed first — used by the catalog page. Ranks by number of
 * finished products, then by average completion, then by total volume.
 */
export function sortByCompletion(groups: CountryGroup[]): CountryGroup[] {
  return [...groups].sort((a, b) => {
    if (b.finished.length !== a.finished.length) {
      return b.finished.length - a.finished.length;
    }
    if (b.avgCompletion !== a.avgCompletion) {
      return b.avgCompletion - a.avgCompletion;
    }
    if (b.total !== a.total) return b.total - a.total;
    return a.country.localeCompare(b.country);
  });
}

/** Subtle grey for countries with no projects — sits just above the paper. */
export const EMPTY_COUNTRY_FILL = "#e7e1d3";

// Brand anchors pulled from the design tokens in globals.css.
const SAGE = { l: 0.74, c: 0.06, h: 130 }; // --rc-sage  #9caf88
const FOREST = { l: 0.36, c: 0.06, h: 150 }; // --rc-forest #344e3c
const GOLD = { l: 0.71, c: 0.1, h: 85 }; // --rc-gold  #c19a4b

interface Oklch {
  l: number;
  c: number;
  h: number;
}

function mix(a: Oklch, b: Oklch, t: number): Oklch {
  return {
    l: a.l + (b.l - a.l) * t,
    c: a.c + (b.c - a.c) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

function oklch({ l, c, h }: Oklch): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}

/**
 * Hybrid choropleth fill:
 * - The green↔amber hue blend follows `greenRatio` (finished vs unfinished).
 * - The shade depth follows `avgCompletion` — a more-complete country reads as a
 *   deeper, richer green; an early-stage one stays lighter and softer.
 * Countries with no projects use {@link EMPTY_COUNTRY_FILL}.
 */
export function countryFillColor(group: {
  total: number;
  greenRatio: number;
  avgCompletion: number;
}): string {
  if (group.total === 0) return EMPTY_COUNTRY_FILL;

  // Green endpoint deepens from sage toward forest as completion rises.
  const greenAnchor = mix(SAGE, FOREST, clamp01(group.avgCompletion / 100));
  // Blend between the amber (gold) anchor and the green anchor by greenRatio.
  const base = mix(GOLD, greenAnchor, clamp01(group.greenRatio));
  return oklch(base);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
