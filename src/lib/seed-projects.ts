import type { Project } from "./schemas";
import { normalizeProject } from "./project-normalization";

/**
 * Example projects seeded into the store on first run. Each is parsed through
 * `projectSchema` so defaults (brandStyle, generated, empty arrays, etc.) are
 * filled in and the seeds are guaranteed valid.
 */
function makeSeed(input: {
  id: string;
  name: string;
  country: string;
  regions: string[];
  positioning: string;
  targetAudience: string;
  travelStyles: Project["travelStyles"];
  travelerTypes: Project["travelerTypes"];
  durations: Project["durations"];
  deliverables: Project["deliverables"];
  status: Project["status"];
  accent: Project["accent"];
  createdAt: string;
  updatedAt: string;
}): Project {
  return normalizeProject(input);
}

export const seedProjects: Project[] = [
  makeSeed({
    id: "japan-family-7",
    name: "Japan Travel Itinerary Product",
    country: "Japan",
    regions: ["Tokyo", "Hakone", "Kyoto", "Osaka"],
    positioning:
      "Human-paced, family-friendly Japan with food, culture, and built-in rest days.",
    targetAudience: "First-time families visiting Japan",
    travelStyles: ["Family-friendly", "Food/culture heavy", "Classic first-timer"],
    travelerTypes: ["Family", "Couple", "Solo", "Group"],
    durations: ["3 days", "5 days", "7 days", "14 days"],
    deliverables: [
      "PDF",
      "Spreadsheet",
      "Packing list",
      "Food guide",
      "Booking checklist",
      "Portfolio image prompts",
    ],
    status: "Ready to sell",
    accent: "terracotta",
    createdAt: "2026-05-02T09:00:00.000Z",
    updatedAt: "2026-06-08T14:30:00.000Z",
  }),
  makeSeed({
    id: "italy-honeymoon-14",
    name: "Italy Honeymoon Itinerary Product",
    country: "Italy",
    regions: ["Rome", "Florence", "Tuscany", "Amalfi Coast", "Venice"],
    positioning:
      "Romantic, scenic, slow-travel Italy designed for unforgettable honeymoons.",
    targetAudience: "Honeymooners and couples",
    travelStyles: ["Romantic", "Premium comfort", "Local-first slow travel"],
    travelerTypes: ["Couple", "Luxury travelers"],
    durations: ["7 days", "10 days", "14 days"],
    deliverables: ["PDF", "Spreadsheet", "Food guide", "Map pins", "Booking checklist"],
    status: "In progress",
    accent: "gold",
    createdAt: "2026-05-18T11:15:00.000Z",
    updatedAt: "2026-06-09T08:45:00.000Z",
  }),
  makeSeed({
    id: "vietnam-food-5",
    name: "Vietnam Food & Culture Itinerary Product",
    country: "Vietnam",
    regions: ["Hanoi", "Hoi An", "Ho Chi Minh City"],
    positioning:
      "Street-food-first, local-led Vietnam for solo travelers and curious foodies.",
    targetAudience: "Solo travelers and food lovers",
    travelStyles: ["Food/culture heavy", "Local-first slow travel", "Budget-friendly"],
    travelerTypes: ["Solo", "Couple", "Group"],
    durations: ["5 days", "7 days"],
    deliverables: ["PDF", "Food guide", "Packing list", "Fiverr listing copy"],
    status: "Draft",
    accent: "sage",
    createdAt: "2026-06-01T16:20:00.000Z",
    updatedAt: "2026-06-10T19:05:00.000Z",
  }),
  makeSeed({
    id: "switzerland-rail-7",
    name: "Switzerland Scenic Rail Itinerary Product",
    country: "Switzerland",
    regions: ["Zurich", "Lucerne", "Interlaken", "Zermatt"],
    positioning:
      "Scenic-rail Switzerland with calm pacing and postcard mountain views.",
    targetAudience: "Couples and comfort-focused travelers",
    travelStyles: ["Nature/adventure", "Premium comfort", "Romantic"],
    travelerTypes: ["Couple", "Family", "Senior travelers"],
    durations: ["5 days", "7 days", "10 days"],
    deliverables: ["PDF", "Spreadsheet", "Map pins", "Booking checklist"],
    status: "Draft",
    accent: "teal",
    createdAt: "2026-06-03T10:00:00.000Z",
    updatedAt: "2026-06-07T12:00:00.000Z",
  }),
  makeSeed({
    id: "thailand-premium-7",
    name: "Thailand Affordable Premium Itinerary Product",
    country: "Thailand",
    regions: ["Bangkok", "Chiang Mai", "Krabi"],
    positioning:
      "Affordable-premium Thailand balancing temples, food, and beach downtime.",
    targetAudience: "Couples and groups wanting value-luxury",
    travelStyles: ["Premium comfort", "Food/culture heavy", "Budget-friendly"],
    travelerTypes: ["Couple", "Group", "Family"],
    durations: ["5 days", "7 days", "10 days"],
    deliverables: ["PDF", "Spreadsheet", "Packing list", "Food guide"],
    status: "In progress",
    accent: "forest",
    createdAt: "2026-05-25T08:30:00.000Z",
    updatedAt: "2026-06-06T17:40:00.000Z",
  }),
];
