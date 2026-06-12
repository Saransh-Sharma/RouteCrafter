import { marketplaceListingSchema, type MarketplaceListing } from "../schemas";
import type { GenerationContext } from "./types";
import { list } from "./context";

/** Build an editable marketplace listing scaffold from the project config. */
export function buildListing(ctx: GenerationContext): MarketplaceListing {
  const { project, config } = ctx;
  const country = project.country || "Country";
  const styleWord = config.travelStyles[0]?.toLowerCase() ?? "custom";

  const titleOptions = [
    `I will create a custom ${country} travel itinerary and packing list`,
    `I will design a personalized ${country} itinerary for solo, couple, family or group travel`,
    `I will plan your ${country} trip day by day with food and transport tips`,
    `I will build a premium ${styleWord} ${country} itinerary tailored to you`,
    `I will craft a ${country} travel plan with PDF and spreadsheet deliverables`,
  ];

  const tags = [
    "travel itinerary",
    "travel planner",
    "trip planner",
    "custom itinerary",
    "vacation planner",
    `${country.toLowerCase()} travel`,
    "travel guide",
    "travel plan",
  ];

  const packages = [
    {
      name: "Basic",
      price: "",
      description: `A focused 3-day ${country} itinerary for one destination, delivered as a PDF.`,
      features: ["3-day itinerary", "1 destination", "PDF delivery"],
    },
    {
      name: "Standard",
      price: "",
      description: `A 5-7 day ${country} itinerary with PDF, spreadsheet, and packing list.`,
      features: [
        "5-7 day itinerary",
        "PDF + spreadsheet",
        "Packing list",
        "Food recommendations",
      ],
    },
    {
      name: "Premium",
      price: "",
      description: `A 10-14 day multi-city ${country} itinerary with all deliverables and a revision.`,
      features: [
        "10-14 day multi-city itinerary",
        "PDF + spreadsheet + packing list",
        "Map pins",
        "1 revision",
      ],
    },
  ];

  const faqs = [
    {
      question: "Do you book hotels or flights for me?",
      answer:
        "No - I design the itinerary and recommend areas and options. You book directly, which keeps you in control of dates and prices.",
    },
    {
      question: "Can you plan for families and other traveler types?",
      answer:
        "Yes. Itineraries are tailored to solo, couple, family, or group travel, with appropriate pacing and rest.",
    },
    {
      question: "Can you make a slow-paced itinerary?",
      answer: "Absolutely - pacing is fully adjustable to your preference.",
    },
    {
      question: "Do you verify opening hours and prices?",
      answer:
        "I provide guidance based on typical information, but live opening hours, prices, tickets, and availability should be confirmed close to travel and are not guaranteed.",
    },
  ];

  const buyerRequirements = [
    "Destination / cities (and whether they're flexible)",
    "Travel dates or season and trip length",
    "Number of travelers and traveler type",
    "Budget level",
    "Interests and the kind of trip you want",
    "Food preferences and dietary restrictions",
    "Accommodation style",
    "Mobility or accessibility needs",
    "Must-see places and places to avoid",
    "Arrival/departure details",
  ];

  const upsells = [
    "Add a second city or region",
    "Add a printable map with pins",
    "Add an extra revision round",
  ];

  return marketplaceListingSchema.parse({
    titleOptions,
    tags,
    shortDescription: `Custom, premium ${country} travel itineraries tailored to your style, pace, and budget.`,
    longDescription: `Get a fully personalized ${country} itinerary built around ${list(
      config.travelStyles,
      "your travel style",
    )}. Includes a day-by-day plan, food and cafe recommendations, transport guidance, and a packing list - delivered as a polished PDF (and spreadsheet on higher tiers). Every plan is custom; nothing is copy-paste.`,
    packages,
    faqs,
    buyerRequirements,
    upsells,
    deliveryNotes:
      "Delivery in 2-4 days depending on tier. You'll receive editable, clearly formatted files.",
  });
}
