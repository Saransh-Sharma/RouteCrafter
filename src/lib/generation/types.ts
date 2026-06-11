import type { BrandStyle, Project, TripConfiguration } from "../schemas";

/** Everything a template needs to render, derived once per project. */
export interface GenerationContext {
  project: Project;
  config: TripConfiguration;
  brand: BrandStyle;
}

export type TemplateGroup =
  | "Positioning"
  | "Visuals"
  | "Itinerary"
  | "Listing"
  | "Guides";

export interface PromptTemplate {
  id: string;
  label: string;
  group: TemplateGroup;
  description: string;
  /** Pure function: context in, copy-paste prompt string out. */
  build: (ctx: GenerationContext) => string;
}
