/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import type { ItineraryOutput, Project } from "@/lib/types";
import { getTheme, themeVars } from "./themes";

const TIME_FIELDS: { key: keyof ItineraryOutput["days"][number]; label: string }[] =
  [
    { key: "morning", label: "Morning" },
    { key: "lunch", label: "Lunch" },
    { key: "afternoon", label: "Afternoon" },
    { key: "evening", label: "Evening" },
    { key: "dinner", label: "Dinner" },
  ];

const NOTE_FIELDS: { key: keyof ItineraryOutput["days"][number]; label: string }[] =
  [
    { key: "transportNotes", label: "Transport" },
    { key: "bookingNotes", label: "Booking" },
    { key: "optionalUpgrade", label: "Upgrade" },
    { key: "lowEnergyAlternative", label: "Low-energy" },
    { key: "rainyDayAlternative", label: "Rainy day" },
    { key: "whyThisWorks", label: "Why it works" },
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
  const theme = getTheme(itinerary.pdfTheme);
  const businessName = project.brandStyle?.businessName?.trim();
  const disclaimer =
    itinerary.verificationNotes ||
    project.brandStyle?.footerDisclaimer ||
    "Verify live opening hours, prices, tickets, and hotel/restaurant availability before travel. Nothing here is presented as guaranteed real-time data.";

  return (
    <div ref={ref} className="rc-doc rc-print-root" style={themeVars(theme)}>
      {/* Cover */}
      <section
        className={`rc-print-page rc-doc-cover${
          itinerary.coverImage ? " has-photo" : ""
        }`}
      >
        {itinerary.coverImage ? (
          <>
            <img
              className="rc-doc-cover-photo"
              src={itinerary.coverImage}
              alt={`${country} cover`}
              crossOrigin="anonymous"
            />
            <div className="rc-doc-cover-scrim" />
          </>
        ) : null}
        <div className="rc-doc-cover-inner">
          <p className="rc-doc-eyebrow">
            {businessName || "Custom Travel Itinerary"}
          </p>
          <div className="rc-doc-rule mt-4" />
          <h1 className="mt-5 text-6xl font-semibold leading-[1.04]">
            {country}
          </h1>
          <p
            className="mt-3 text-2xl"
            style={{
              color: itinerary.coverImage
                ? "rgba(255,255,255,0.92)"
                : "var(--doc-ink-soft)",
            }}
          >
            {itinerary.title}
          </p>
          {itinerary.subtitle ? (
            <p
              className="mt-1 text-base"
              style={{
                color: itinerary.coverImage
                  ? "rgba(255,255,255,0.8)"
                  : "var(--doc-ink-muted)",
              }}
            >
              {itinerary.subtitle}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap gap-2">
            <span className="rc-doc-chip">{itinerary.duration}</span>
            <span className="rc-doc-chip">{itinerary.travelerType}</span>
            {itinerary.style ? (
              <span className="rc-doc-chip">{itinerary.style}</span>
            ) : null}
            {itinerary.budget ? (
              <span className="rc-doc-chip">{itinerary.budget}</span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Overview */}
      <section className="rc-print-page px-14 py-16">
        <p className="rc-doc-eyebrow">The trip at a glance</p>
        <div className="rc-doc-rule mt-3" />
        <h2 className="mt-5 text-3xl font-semibold">Trip overview</h2>
        {itinerary.overview ? (
          <p
            className="mt-4 text-base leading-relaxed"
            style={{ color: "var(--doc-ink-soft)" }}
          >
            {itinerary.overview}
          </p>
        ) : null}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <DocField label="Who it's for" value={itinerary.whoFor} />
          <DocField label="Route" value={itinerary.routeSummary} />
          <DocField label="Best stay areas" value={itinerary.bestStayAreas} />
          <DocField label="Pace & style" value={paceStyle(itinerary)} />
        </div>
      </section>

      {/* Days */}
      {itinerary.days.map((day) => {
        const times = TIME_FIELDS.filter((f) => day[f.key]);
        const notes = NOTE_FIELDS.filter((f) => day[f.key]);
        return (
          <section key={day.day} className="rc-print-page px-14 py-14">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="rc-doc-eyebrow">Day {String(day.day).padStart(2, "0")}</p>
                <h3 className="mt-1 text-3xl font-semibold">{day.title}</h3>
                {day.base ? (
                  <p
                    className="mt-1 text-sm uppercase tracking-[0.18em]"
                    style={{ color: "var(--doc-ink-muted)" }}
                  >
                    {day.base}
                  </p>
                ) : null}
              </div>
              <span className="rc-day-num">{day.day}</span>
            </div>

            {day.image ? (
              <div
                className="mt-6 overflow-hidden rounded-2xl"
                style={{ border: "1px solid var(--doc-border)" }}
              >
                <img
                  className="rc-doc-img"
                  src={day.image}
                  alt={`Day ${day.day}`}
                  style={{ height: "260px" }}
                  crossOrigin="anonymous"
                />
              </div>
            ) : null}

            <div className="mt-7">
              {times.map((f) => (
                <div key={f.key as string} className="rc-day-row">
                  <div className="rc-day-row-label">{f.label}</div>
                  <div className="rc-day-row-body">{day[f.key] as string}</div>
                </div>
              ))}
            </div>

            {notes.length ? (
              <div
                className="mt-6 rounded-2xl p-5"
                style={{
                  background: "var(--doc-accent-soft)",
                }}
              >
                <p className="rc-doc-eyebrow">Good to know</p>
                <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                  {notes.map((f) => (
                    <div key={f.key as string} className="text-sm">
                      <span
                        className="font-semibold"
                        style={{ color: "var(--doc-ink)" }}
                      >
                        {f.label}:{" "}
                      </span>
                      <span style={{ color: "var(--doc-ink-soft)" }}>
                        {day[f.key] as string}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}

      {/* Guides */}
      {guides.length ? (
        <section className="rc-print-page px-14 py-16">
          <p className="rc-doc-eyebrow">Plan with confidence</p>
          <div className="rc-doc-rule mt-3" />
          <h2 className="mt-5 text-3xl font-semibold">Guides & checklists</h2>
          <div className="mt-6 space-y-6">
            {guides.map((g) => (
              <div key={g.key}>
                <h3 className="text-lg font-semibold">{g.label}</h3>
                <div className="rc-doc-hairline mt-2" />
                <p
                  className="mt-3 whitespace-pre-wrap text-sm leading-relaxed"
                  style={{ color: "var(--doc-ink-soft)" }}
                >
                  {itinerary[g.key] as string}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Closing / disclaimer */}
      <section className="rc-print-page px-14 py-16">
        <div className="rc-doc-rule" />
        <p className="mt-5 text-xl font-semibold">
          {businessName || "Thank you & safe travels"}
        </p>
        <p
          className="mt-4 max-w-2xl text-xs leading-relaxed"
          style={{ color: "var(--doc-ink-muted)" }}
        >
          {disclaimer}
        </p>
      </section>
    </div>
  );
});

function paceStyle(itinerary: ItineraryOutput): string {
  return [itinerary.travelerType, itinerary.style, itinerary.budget]
    .filter(Boolean)
    .join(" - ");
}

function DocField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--doc-ink-muted)" }}
      >
        {label}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--doc-ink-soft)" }}>
        {value}
      </p>
    </div>
  );
}
