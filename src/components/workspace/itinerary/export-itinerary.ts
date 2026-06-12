import type { ItineraryOutput, Project } from "@/lib/types";

/** Itinerary -> Markdown document. */
export function itineraryToMarkdown(
  itinerary: ItineraryOutput,
  project: Project,
): string {
  const lines: string[] = [];
  lines.push(`# ${itinerary.title}`);
  if (itinerary.subtitle) lines.push(`_${itinerary.subtitle}_`);
  lines.push("");

  const meta = [
    ["Country", itinerary.country || project.country],
    ["Duration", itinerary.duration],
    ["Traveler", itinerary.travelerType],
    ["Overview", itinerary.overview],
    ["Who it's for", itinerary.whoFor],
    ["Route", itinerary.routeSummary],
    ["Best stay areas", itinerary.bestStayAreas],
  ].filter(([, v]) => v);
  for (const [label, value] of meta) lines.push(`**${label}:** ${value}`);

  lines.push("\n## Day-by-day\n");
  for (const day of itinerary.days) {
    lines.push(`### Day ${day.day} - ${day.title}${day.base ? ` (${day.base})` : ""}`);
    const fields: [string, string][] = [
      ["Morning", day.morning],
      ["Lunch", day.lunch],
      ["Afternoon", day.afternoon],
      ["Evening", day.evening],
      ["Dinner", day.dinner],
      ["Transport", day.transportNotes],
      ["Booking", day.bookingNotes],
      ["Walking", day.walkingIntensity],
      ["Optional upgrade", day.optionalUpgrade],
      ["Low-energy alternative", day.lowEnergyAlternative],
      ["Rainy-day alternative", day.rainyDayAlternative],
      ["Why this works", day.whyThisWorks],
    ];
    for (const [label, value] of fields) {
      if (value) lines.push(`- **${label}:** ${value}`);
    }
    lines.push("");
  }

  const sections: [string, string][] = [
    ["Food & cafe guide", itinerary.foodGuide],
    ["Transport guide", itinerary.transportGuide],
    ["Packing list", itinerary.packingList],
    ["Etiquette & safety", itinerary.etiquetteSafety],
    ["Booking checklist", itinerary.bookingChecklist],
    ["Personalization questions", itinerary.personalizationQuestions],
    ["Verification notes", itinerary.verificationNotes],
  ];
  for (const [label, value] of sections) {
    if (value) lines.push(`## ${label}\n\n${value}\n`);
  }

  return lines.join("\n");
}

export function downloadItineraryMarkdown(
  itinerary: ItineraryOutput,
  project: Project,
) {
  const slug = (project.country || "project").toLowerCase();
  const blob = new Blob([itineraryToMarkdown(itinerary, project)], {
    type: "text/markdown",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-${itinerary.duration.replace(/\s+/g, "")}-itinerary.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
