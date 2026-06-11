import * as React from "react";
import type { ItineraryOutput, Project } from "@/lib/types";

const DAY_FIELDS: { key: keyof ItineraryOutput["days"][number]; label: string }[] =
  [
    { key: "morning", label: "Morning" },
    { key: "lunch", label: "Lunch" },
    { key: "afternoon", label: "Afternoon" },
    { key: "evening", label: "Evening" },
    { key: "dinner", label: "Dinner" },
    { key: "transportNotes", label: "Transport" },
    { key: "bookingNotes", label: "Booking" },
    { key: "optionalUpgrade", label: "Optional upgrade" },
    { key: "lowEnergyAlternative", label: "Low-energy alternative" },
    { key: "rainyDayAlternative", label: "Rainy-day alternative" },
    { key: "whyThisWorks", label: "Why this works" },
  ];

const GUIDE_FIELDS: { key: keyof ItineraryOutput; label: string }[] = [
  { key: "foodGuide", label: "Food & cafe guide" },
  { key: "transportGuide", label: "Transport guide" },
  { key: "packingList", label: "Packing list" },
  { key: "etiquetteSafety", label: "Etiquette & safety" },
  { key: "bookingChecklist", label: "Booking checklist" },
];

/** Premium, print-optimized itinerary document (screen preview + PDF source). */
export const ItineraryDocument = React.forwardRef<
  HTMLDivElement,
  { itinerary: ItineraryOutput; project: Project }
>(function ItineraryDocument({ itinerary, project }, ref) {
  const country = itinerary.country || project.country || "Your trip";
  const guides = GUIDE_FIELDS.filter((g) => itinerary[g.key]);

  return (
    <div ref={ref} className="rc-doc rc-print-root">
      {/* Cover */}
      <section className="rc-print-page flex min-h-[60vh] flex-col justify-center border border-border-soft p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-terracotta">
          Custom Travel Itinerary
        </p>
        <h1 className="mt-3 text-5xl font-semibold text-ink">{country}</h1>
        <p className="mt-2 text-xl text-ink-soft">{itinerary.title}</p>
        {itinerary.subtitle ? (
          <p className="mt-1 text-base text-ink-muted">{itinerary.subtitle}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-sage-soft px-3 py-1 font-medium text-forest">
            {itinerary.duration}
          </span>
          <span className="rounded-full bg-paper-2 px-3 py-1 font-medium text-ink-soft">
            {itinerary.travelerType}
          </span>
          {itinerary.budget ? (
            <span className="rounded-full bg-paper-2 px-3 py-1 font-medium text-ink-soft">
              {itinerary.budget}
            </span>
          ) : null}
        </div>
      </section>

      {/* Overview */}
      <section className="rc-print-page space-y-5 p-12">
        <h2 className="text-2xl font-semibold text-ink">Trip overview</h2>
        {itinerary.overview ? (
          <p className="text-ink-soft">{itinerary.overview}</p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DocField label="Who it's for" value={itinerary.whoFor} />
          <DocField label="Route" value={itinerary.routeSummary} />
          <DocField label="Best stay areas" value={itinerary.bestStayAreas} />
        </div>
      </section>

      {/* Days */}
      {itinerary.days.map((day) => (
        <section key={day.day} className="rc-print-page space-y-4 p-12">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-semibold uppercase tracking-wide text-terracotta">
              Day {day.day}
            </span>
            <h3 className="text-xl font-semibold text-ink">{day.title}</h3>
            {day.base ? (
              <span className="text-sm text-ink-muted">{day.base}</span>
            ) : null}
          </div>
          <div className="space-y-2.5">
            {DAY_FIELDS.map((f) => {
              const value = day[f.key] as string;
              if (!value) return null;
              return (
                <div key={f.key as string} className="text-sm">
                  <span className="font-semibold text-ink">{f.label}: </span>
                  <span className="text-ink-soft">{value}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Guides */}
      {guides.length ? (
        <section className="rc-print-page space-y-5 p-12">
          <h2 className="text-2xl font-semibold text-ink">Guides & checklists</h2>
          {guides.map((g) => (
            <div key={g.key} className="space-y-1">
              <h3 className="text-base font-semibold text-ink">{g.label}</h3>
              <p className="whitespace-pre-wrap text-sm text-ink-soft">
                {itinerary[g.key] as string}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {/* Disclaimer */}
      <section className="rc-print-page p-12">
        <p className="text-xs text-ink-muted">
          {itinerary.verificationNotes ||
            "Verify live opening hours, prices, tickets, and hotel/restaurant availability before travel. Nothing here is presented as guaranteed real-time data."}
        </p>
      </section>
    </div>
  );
});

function DocField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-ink-soft">{value}</p>
    </div>
  );
}
