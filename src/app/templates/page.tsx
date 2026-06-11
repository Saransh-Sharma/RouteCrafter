import { ComingSoon } from "@/components/layout/ComingSoon";

export default function TemplatesPage() {
  return (
    <ComingSoon
      eyebrow="Template Library"
      title="Reusable presets & frameworks"
      subtitle="Start any project from a traveler preset or country starter, and reuse prompt, PDF, and listing frameworks across listings."
      phase={11}
      bullets={[
        "Traveler presets: honeymoon, family, solo, luxury, budget",
        "Country starters: Japan, Italy, Vietnam, Thailand, Switzerland",
        "Reusable prompt templates",
        "PDF document templates",
        "Visual style presets",
        "Itinerary & listing frameworks",
      ]}
    />
  );
}
