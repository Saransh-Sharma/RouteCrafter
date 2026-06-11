import { z } from "zod";

/** Marketplace (Fiverr/Etsy/Gumroad) listing copy. Populated in Phase 8. */
export const listingPackageSchema = z.object({
  name: z.string(),
  price: z.string().default(""),
  description: z.string().default(""),
  features: z.array(z.string()).default([]),
});

export const faqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export const marketplaceListingSchema = z.object({
  titleOptions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  shortDescription: z.string().default(""),
  longDescription: z.string().default(""),
  packages: z.array(listingPackageSchema).default([]),
  faqs: z.array(faqItemSchema).default([]),
  buyerRequirements: z.array(z.string()).default([]),
  upsells: z.array(z.string()).default([]),
  deliveryNotes: z.string().default(""),
});

export type ListingPackage = z.infer<typeof listingPackageSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;
export type MarketplaceListing = z.infer<typeof marketplaceListingSchema>;
