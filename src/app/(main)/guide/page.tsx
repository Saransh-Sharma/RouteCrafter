import type { Metadata } from "next";
import { UserGuide } from "@/components/guide/UserGuide";

export const metadata: Metadata = {
  title: "User Guide | RouteCrafter",
  description:
    "How to use RouteCrafter to build country-specific itinerary products and marketplace listings.",
};

export default function GuidePage() {
  return <UserGuide />;
}
