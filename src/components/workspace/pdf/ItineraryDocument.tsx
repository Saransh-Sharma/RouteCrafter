/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { Eye, Trash2 } from "lucide-react";
import type { ItineraryOutput, Project } from "@/lib/types";
import { getTheme, themeVars } from "./themes";
import {
  AnchorSlot,
  EditableText,
  Removable,
  isHidden,
  type DocEditor,
} from "./doc-editing";

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

function cssImageUrl(src: string): string {
  return `url("${src
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\a ")
    .replace(/\r/g, "\\d ")
    .replace(/\f/g, "\\c ")}")`;
}

/** Premium, print-optimized itinerary document (screen preview + PDF source). */
export const ItineraryDocument = React.forwardRef<
  HTMLDivElement,
  {
    itinerary: ItineraryOutput;
    project: Project;
    onAssetSettled?: () => void;
    editable?: boolean;
    exportMode?: boolean;
    editor?: DocEditor;
  }
>(function ItineraryDocument(
  {
    itinerary,
    project,
    onAssetSettled,
    editable = false,
    exportMode = false,
    editor,
  },
  ref,
) {
  const isEdit = editable && Boolean(editor);
  const patch = React.useMemo(
    () => editor?.patch ?? (() => {}),
    [editor],
  );

  const setField = React.useCallback(
    <K extends keyof ItineraryOutput>(key: K, value: ItineraryOutput[K]) => {
      patch((it) => ({ ...it, [key]: value }));
    },
    [patch],
  );
  const setDayField = React.useCallback(
    (
      dayNum: number,
      key: keyof ItineraryOutput["days"][number],
      value: string,
    ) => {
      patch((it) => ({
        ...it,
        days: it.days.map((day) =>
          day.day === dayNum ? { ...day, [key]: value } : day,
        ),
      }));
    },
    [patch],
  );
  const hidden = (key: string) => isHidden(itinerary, key);
  const toggle = (key: string) => {
    patch((it) => {
      const set = new Set(it.hiddenElements ?? []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...it, hiddenElements: [...set] };
    });
  };

  const country = itinerary.country || project.country || "Your trip";
  const guides = GUIDE_FIELDS.filter((g) => itinerary[g.key]);
  const theme = getTheme(itinerary.pdfTheme);
  const businessName = project.brandStyle?.businessName?.trim();
  const disclaimer =
    itinerary.verificationNotes ||
    project.brandStyle?.footerDisclaimer ||
    "Verify live opening hours, prices, tickets, and hotel/restaurant availability before travel. Nothing here is presented as guaranteed real-time data.";

  return (
    <div
      ref={ref}
      className={`rc-doc rc-print-root${isEdit ? " rc-doc-editing" : ""}${
        exportMode ? " rc-doc-export" : ""
      }`}
      style={themeVars(theme)}
    >
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
              onLoad={onAssetSettled}
              onError={onAssetSettled}
            />
            <div className="rc-doc-cover-scrim" />
          </>
        ) : null}
        <div className="rc-doc-cover-inner">
          <p className="rc-doc-eyebrow">
            {businessName || "Custom Travel Itinerary"}
          </p>
          <div className="rc-doc-rule mt-4" />
          <EditableText
            as="h1"
            value={country}
            editable={isEdit}
            onCommit={(next) => setField("country", next)}
            className="mt-5 text-6xl font-semibold leading-[1.04]"
          />
          <EditableText
            as="p"
            value={itinerary.title}
            editable={isEdit}
            onCommit={(next) => setField("title", next)}
            className="mt-3 text-2xl"
            style={{
              color: itinerary.coverImage
                ? "rgba(255,255,255,0.92)"
                : "var(--doc-ink-soft)",
            }}
          />
          {itinerary.subtitle || isEdit ? (
            <Removable
              editable={isEdit}
              hidden={hidden("subtitle")}
              onToggle={() => toggle("subtitle")}
              label="subtitle"
            >
              <EditableText
                as="p"
                value={itinerary.subtitle}
                editable={isEdit}
                placeholder="Subtitle"
                onCommit={(next) => setField("subtitle", next)}
                className="mt-1 text-base"
                style={{
                  color: itinerary.coverImage
                    ? "rgba(255,255,255,0.8)"
                    : "var(--doc-ink-muted)",
                }}
              />
            </Removable>
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
          <AnchorSlot
            anchor="cover"
            itinerary={itinerary}
            editable={isEdit}
            patch={patch}
          />
        </div>
      </section>

      {/* Overview */}
      <section className="rc-print-page rc-doc-overview-page px-14 py-16">
        <p className="rc-doc-eyebrow">The trip at a glance</p>
        <div className="rc-doc-rule mt-3" />
        <h2 className="mt-5 text-3xl font-semibold">Trip overview</h2>
        {itinerary.overview || isEdit ? (
          <Removable
            editable={isEdit}
            hidden={hidden("overview")}
            onToggle={() => toggle("overview")}
            label="overview"
          >
            <EditableText
              as="p"
              value={itinerary.overview}
              editable={isEdit}
              placeholder="Trip overview..."
              onCommit={(next) => setField("overview", next)}
              className="mt-4 text-base leading-relaxed"
              style={{ color: "var(--doc-ink-soft)" }}
            />
          </Removable>
        ) : null}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <DocField
            label="Who it's for"
            value={itinerary.whoFor}
            editable={isEdit}
            onCommit={(next) => setField("whoFor", next)}
          />
          <DocField
            label="Route"
            value={itinerary.routeSummary}
            editable={isEdit}
            onCommit={(next) => setField("routeSummary", next)}
          />
          <DocField
            label="Best stay areas"
            value={itinerary.bestStayAreas}
            editable={isEdit}
            onCommit={(next) => setField("bestStayAreas", next)}
          />
          <DocField label="Pace & style" value={paceStyle(itinerary)} />
        </div>
        <AnchorSlot
          anchor="overview"
          itinerary={itinerary}
          editable={isEdit}
          patch={patch}
        />
      </section>

      {/* Days */}
      {itinerary.days.map((day) => {
        const dayKey = `day:${day.day}`;
        const times = TIME_FIELDS.filter((f) => day[f.key] || isEdit);
        const notes = NOTE_FIELDS.filter((f) => day[f.key]);
        if (hidden(dayKey)) {
          if (!isEdit) return null;
          return (
            <section
              key={day.day}
              className="rc-print-page rc-doc-day-page rc-edit-only flex items-center justify-center px-14 py-14"
            >
              <button
                type="button"
                onClick={() => toggle(dayKey)}
                className="rc-restore-bar"
                title={`Restore day ${day.day}`}
              >
                <Eye className="size-3.5" />
                Restore Day {day.day}
              </button>
            </section>
          );
        }
        return (
          <section key={day.day} className="rc-print-page rc-doc-day-page px-14 py-14">
            {isEdit ? (
              <button
                type="button"
                onClick={() => toggle(dayKey)}
                className="rc-edit-only rc-remove-btn rc-remove-day"
                title={`Remove day ${day.day}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
            <div className="rc-doc-day-header flex items-end justify-between gap-4">
              <div className="rc-doc-day-heading min-w-0">
                <p className="rc-doc-eyebrow">
                  Day {String(day.day).padStart(2, "0")}
                </p>
                <EditableText
                  as="h3"
                  value={day.title}
                  editable={isEdit}
                  placeholder="Day title"
                  onCommit={(next) => setDayField(day.day, "title", next)}
                  className="rc-doc-day-title mt-1 text-3xl font-semibold"
                />
                {day.base || isEdit ? (
                  <EditableText
                    as="p"
                    value={day.base}
                    editable={isEdit}
                    placeholder="Base city"
                    onCommit={(next) => setDayField(day.day, "base", next)}
                    className="rc-doc-day-base mt-1 text-sm uppercase tracking-[0.18em]"
                    style={{ color: "var(--doc-ink-muted)" }}
                  />
                ) : null}
              </div>
              <span className="rc-day-num">{day.day}</span>
            </div>

            {day.image ? (
              <Removable
                editable={isEdit}
                hidden={hidden(`${dayKey}:image`)}
                onToggle={() => toggle(`${dayKey}:image`)}
                label="day image"
                className="rc-doc-day-image-slot"
              >
                <div
                  className="rc-doc-day-image overflow-hidden rounded-2xl"
                  style={{ border: "1px solid var(--doc-border)" }}
                >
                  <div
                    className="rc-doc-img-frame rc-doc-day-img-frame"
                    style={
                      exportMode
                        ? { backgroundImage: cssImageUrl(day.image) }
                        : undefined
                    }
                  >
                    <img
                      className="rc-doc-img"
                      src={day.image ?? ""}
                      alt={`Day ${day.day}`}
                      onLoad={onAssetSettled}
                      onError={onAssetSettled}
                    />
                  </div>
                </div>
              </Removable>
            ) : null}

            <div className="rc-doc-day-schedule mt-7">
              {times.map((f) => (
                <div key={f.key as string} className="rc-day-row">
                  <div className="rc-day-row-label">{f.label}</div>
                  <EditableText
                    as="div"
                    value={(day[f.key] as string) ?? ""}
                    editable={isEdit}
                    placeholder={`${f.label}...`}
                    onCommit={(next) => setDayField(day.day, f.key, next)}
                    className="rc-day-row-body"
                  />
                </div>
              ))}
            </div>

            {notes.length ? (
              <Removable
                editable={isEdit}
                hidden={hidden(`${dayKey}:notes`)}
                onToggle={() => toggle(`${dayKey}:notes`)}
                label="notes"
                className="rc-doc-day-notes-slot"
              >
                <div
                  className="rc-doc-section rc-day-notes rounded-2xl"
                  style={{ background: "var(--doc-accent-soft)" }}
                >
                  <p className="rc-doc-eyebrow">Good to know</p>
                  <div className="rc-day-notes-grid mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                    {notes.map((f) => (
                      <div key={f.key as string} className="rc-day-note text-sm">
                        <span
                          className="font-semibold"
                          style={{ color: "var(--doc-ink)" }}
                        >
                          {f.label}:{" "}
                        </span>
                        <EditableText
                          as="span"
                          value={(day[f.key] as string) ?? ""}
                          editable={isEdit}
                          onCommit={(next) => setDayField(day.day, f.key, next)}
                          style={{ color: "var(--doc-ink-soft)" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </Removable>
            ) : null}

            <AnchorSlot
              anchor={dayKey}
              itinerary={itinerary}
              editable={isEdit}
              patch={patch}
            />
          </section>
        );
      })}

      {/* Guides */}
      {guides.length || isEdit ? (
        <section className="rc-print-page rc-doc-guides-page px-14 py-16">
          <p className="rc-doc-eyebrow">Plan with confidence</p>
          <div className="rc-doc-rule mt-3" />
          <h2 className="mt-5 text-3xl font-semibold">Guides & checklists</h2>
          <div className="mt-6 space-y-6">
            {guides.map((g) => (
              <Removable
                key={g.key}
                editable={isEdit}
                hidden={hidden(`guide:${g.key}`)}
                onToggle={() => toggle(`guide:${g.key}`)}
                label={g.label}
              >
                <div className="rc-doc-section">
                  <h3 className="text-lg font-semibold">{g.label}</h3>
                  <div className="rc-doc-hairline mt-2" />
                  <EditableText
                    as="p"
                    value={itinerary[g.key] as string}
                    editable={isEdit}
                    onCommit={(next) => setField(g.key, next)}
                    className="mt-3 whitespace-pre-wrap text-sm leading-relaxed"
                    style={{ color: "var(--doc-ink-soft)" }}
                  />
                </div>
              </Removable>
            ))}
          </div>
          <AnchorSlot
            anchor="guides"
            itinerary={itinerary}
            editable={isEdit}
            patch={patch}
          />
        </section>
      ) : null}

      {/* Closing / disclaimer */}
      <section className="rc-print-page rc-doc-closing-page px-14 py-16">
        <div className="rc-doc-rule" />
        <p className="mt-5 text-xl font-semibold">
          {businessName || "Thank you & safe travels"}
        </p>
        <EditableText
          as="p"
          value={disclaimer}
          editable={isEdit}
          onCommit={(next) => setField("verificationNotes", next)}
          className="mt-4 max-w-2xl text-xs leading-relaxed"
          style={{ color: "var(--doc-ink-muted)" }}
        />
        <AnchorSlot
          anchor="closing"
          itinerary={itinerary}
          editable={isEdit}
          patch={patch}
        />
      </section>
    </div>
  );
});

function paceStyle(itinerary: ItineraryOutput): string {
  return [itinerary.travelerType, itinerary.style, itinerary.budget]
    .filter(Boolean)
    .join(" - ");
}

function DocField({
  label,
  value,
  editable = false,
  onCommit,
}: {
  label: string;
  value: string;
  editable?: boolean;
  onCommit?: (next: string) => void;
}) {
  if (!value && !editable) return null;
  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--doc-ink-muted)" }}
      >
        {label}
      </p>
      <EditableText
        as="p"
        value={value}
        editable={editable && Boolean(onCommit)}
        placeholder={`${label}...`}
        onCommit={(next) => onCommit?.(next)}
        className="mt-1 text-sm"
        style={{ color: "var(--doc-ink-soft)" }}
      />
    </div>
  );
}
