/**
 * Public type surface for the app. Domain types are inferred from the Zod
 * schemas (Phase 2) and re-exported here so existing `@/lib/types` imports keep
 * working. UI-only types that don't need validation live here directly.
 */

export type {
  Project,
  BrandStyle,
  TripConfiguration,
  DayPlan,
  CustomBlock,
  ItineraryOutput,
  ItineraryMatrix,
  MatrixCell,
  MatrixVariation,
  PortfolioImagePrompt,
  ImagePromptKind,
  MarketplaceListing,
  ListingPackage,
  FaqItem,
  AiAcceptedRun,
  Duration,
  TravelerType,
  TravelStyle,
  Pace,
  Budget,
  Accommodation,
  FoodPref,
  TransportPref,
  Interest,
  Constraint,
  Deliverable,
  ProjectStatus,
  Accent,
  BrandVoice,
  PdfTheme,
  OfferModel,
  SalesChannel,
  OutputRequirement,
  TransportMode,
  RouteStop,
  PlannedEdition,
  PublishReview,
  ProductionPlan,
} from "./schemas";

/** A module/section inside the project workspace (UI-only). */
export interface WorkspaceModule {
  id: string;
  label: string;
  description: string;
  phase: number;
}
