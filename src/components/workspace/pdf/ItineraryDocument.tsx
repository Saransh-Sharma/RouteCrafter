/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { Eye, Trash2 } from "lucide-react";
import type {
  DayDetailRecommendation,
  ItineraryOutput,
  Project,
} from "@/lib/types";
import { getTheme, themeVars } from "./themes";
import {
  AnchorSlot,
  EditableText,
  Removable,
  isHidden,
  type DocEditor,
} from "./doc-editing";
import {
  buildPdfPages,
  type DayNoteKey,
  type DayTimeKey,
  type GuideKey,
  type OverviewKey,
  type PdfDayNote,
  type PdfDayRow,
  type PdfPage,
  type PdfTextBlock,
} from "./pdf-page-model";

type DetailSectionKey = "restaurants" | "stays" | "activities" | "shopping";

const DETAIL_SECTIONS: { key: DetailSectionKey; label: string }[] = [
  { key: "restaurants", label: "Restaurants & cafes" },
  { key: "stays", label: "Stays" },
  { key: "activities", label: "Activities & experiences" },
  { key: "shopping", label: "Shopping" },
];

/** Premium, print-optimized itinerary document (screen preview + PDF source). */
export const ItineraryDocument = React.forwardRef<
  HTMLDivElement,
  {
    itinerary: ItineraryOutput;
    project: Project;
    onAssetSettled?: () => void;
    editable?: boolean;
    editor?: DocEditor;
  }
>(function ItineraryDocument(
  {
    itinerary,
    project,
    onAssetSettled,
    editable = false,
    editor,
  },
  ref,
) {
  const isEdit = editable && Boolean(editor);
  const patch = React.useMemo(() => editor?.patch ?? (() => {}), [editor]);
  const pages = React.useMemo(() => buildPdfPages(itinerary), [itinerary]);

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
  const setDetailField = React.useCallback(
    (
      dayNum: number,
      section: DetailSectionKey,
      index: number,
      key: keyof DayDetailRecommendation,
      value: string,
    ) => {
      patch((it) => ({
        ...it,
        days: it.days.map((day) => {
          if (day.day !== dayNum || !day.details) return day;
          const list = day.details[section];
          if (!list[index]) return day;
          return {
            ...day,
            details: {
              ...day.details,
              [section]: list.map((item, i) =>
                i === index ? { ...item, [key]: value } : item,
              ),
            },
          };
        }),
      }));
    },
    [patch],
  );
  const setTriviaText = React.useCallback(
    (dayNum: number, index: number, value: string) => {
      patch((it) => ({
        ...it,
        days: it.days.map((day) => {
          if (day.day !== dayNum || !day.details) return day;
          return {
            ...day,
            details: {
              ...day.details,
              trivia: day.details.trivia.map((item, i) =>
                i === index ? { ...item, text: value } : item,
              ),
            },
          };
        }),
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
  const theme = getTheme(itinerary.pdfTheme);
  const businessName = project.brandStyle?.businessName?.trim();
  const disclaimer =
    itinerary.verificationNotes ||
    project.brandStyle?.footerDisclaimer ||
    "Verify live opening hours, prices, tickets, and hotel/restaurant availability before travel. Nothing here is presented as guaranteed real-time data.";

  const renderEditableOverview = (
    field: PdfTextBlock<OverviewKey>,
  ): React.ReactNode => {
    if (field.key === "paceStyle") {
      return <p className="rc-doc-field-body">{field.value}</p>;
    }
    if (field.key === "overview") {
      return (
        <EditableText
          as="p"
          value={field.value}
          editable={isEdit && field.chunkCount === 1}
          placeholder="Trip overview..."
          onCommit={(next) => setField("overview", next)}
          className="rc-doc-overview-lede"
        />
      );
    }
    const commitOverviewField = (next: string) => {
      if (
        field.key === "whoFor" ||
        field.key === "routeSummary" ||
        field.key === "bestStayAreas"
      ) {
        setField(field.key, next);
      }
    };
    return (
      <EditableText
        as="p"
        value={field.value}
        editable={isEdit && field.chunkCount === 1}
        placeholder={`${field.label}...`}
        onCommit={commitOverviewField}
        className="rc-doc-field-body"
      />
    );
  };

  const renderPage = (page: PdfPage, index: number) => {
    switch (page.type) {
      case "cover":
        return renderCover(index);
      case "overview":
      case "overview-continuation":
        return renderOverview(page, index);
      case "day-plan":
      case "day-image-plan":
      case "day-plan-continuation":
        return renderDayPlan(page, index);
      case "day-notes":
        return renderDayNotes(page, index);
      case "local-details":
        return renderDetails(page, index);
      case "guides":
      case "guides-continuation":
        return renderGuides(page, index);
      case "closing":
        return renderClosing(index);
      default:
        return null;
    }
  };

  const renderCover = (index: number) => (
    <section
      key={`page-${index}-cover`}
      className={`rc-print-page rc-doc-cover${
        itinerary.coverImage ? " has-photo" : " no-photo"
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
      ) : (
        <div aria-hidden="true" className="rc-doc-cover-watermark">
          {country}
        </div>
      )}
      <div className="rc-doc-cover-inner">
        <div className="rc-doc-cover-copy">
          <p className="rc-doc-eyebrow">
            {businessName || "Custom Travel Itinerary"}
          </p>
          <div className="rc-doc-rule rc-doc-cover-rule" />
          <EditableText
            as="h1"
            value={country}
            editable={isEdit}
            onCommit={(next) => setField("country", next)}
            className="rc-doc-cover-title"
          />
          <EditableText
            as="p"
            value={itinerary.title}
            editable={isEdit}
            onCommit={(next) => setField("title", next)}
            className="rc-doc-cover-subtitle"
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
                className="rc-doc-cover-meta"
              />
            </Removable>
          ) : null}
          <div className="rc-doc-cover-chips">
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
        {!itinerary.coverImage ? (
          <div className="rc-doc-cover-side">
            <p>{itinerary.duration}</p>
            <p>{itinerary.routeSummary || project.regions.join(" - ")}</p>
          </div>
        ) : null}
      </div>
    </section>
  );

  const renderOverview = (
    page: Extract<PdfPage, { type: "overview" | "overview-continuation" }>,
    index: number,
  ) => (
    <section
      key={`page-${index}-${page.type}`}
      className={`rc-print-page rc-doc-overview-page${
        page.type === "overview-continuation" ? " rc-doc-continuation-page" : ""
      }`}
    >
      {page.type === "overview" ? (
        <>
          <p className="rc-doc-eyebrow">The trip at a glance</p>
          <div className="rc-doc-rule rc-doc-title-rule" />
          <h2 className="rc-doc-page-title">Trip overview</h2>
        </>
      ) : (
        <ContinuationHeader label="Trip overview continued" />
      )}
      <div className="rc-doc-overview-grid">
        {page.fields.map((field) => {
          const key = `${field.key}-${field.chunkIndex}`;
          if (field.key === "overview") {
            return (
              <Removable
                key={key}
                editable={isEdit}
                hidden={hidden("overview")}
                onToggle={() => toggle("overview")}
                label="overview"
              >
                <div className="rc-doc-overview-lede-wrap">
                  {field.chunkCount > 1 ? (
                    <p className="rc-doc-field-label">
                      Overview {field.chunkIndex + 1}/{field.chunkCount}
                    </p>
                  ) : null}
                  {renderEditableOverview(field)}
                </div>
              </Removable>
            );
          }
          return (
            <div key={key} className="rc-doc-field">
              <p className="rc-doc-field-label">
                {field.label}
                {field.chunkCount > 1
                  ? ` ${field.chunkIndex + 1}/${field.chunkCount}`
                  : ""}
              </p>
              {renderEditableOverview(field)}
            </div>
          );
        })}
      </div>
      {page.type === "overview" ? (
        <AnchorSlot
          anchor="overview"
          itinerary={itinerary}
          editable={isEdit}
          patch={patch}
        />
      ) : null}
    </section>
  );

  const renderDayPlan = (
    page: Extract<
      PdfPage,
      { type: "day-plan" | "day-image-plan" | "day-plan-continuation" }
    >,
    index: number,
  ) => {
    const day = itinerary.days[page.dayIndex];
    const dayKey = `day:${day.day}`;
    return (
      <section
        key={`page-${index}-${page.type}-${day.day}`}
        className={`rc-print-page rc-doc-day-page rc-doc-${page.type}${
          page.type === "day-plan-continuation"
            ? " rc-doc-continuation-page"
            : ""
        }`}
      >
        {isEdit && page.type !== "day-plan-continuation" ? (
          <button
            type="button"
            onClick={() => toggle(dayKey)}
            className="rc-edit-only rc-remove-btn rc-remove-day"
            title={`Remove day ${day.day}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
        {page.type === "day-plan-continuation" ? (
          <ContinuationHeader
            label={`Day ${String(day.day).padStart(2, "0")} continued`}
          />
        ) : (
          <DayHeader
            day={day}
            editable={isEdit}
            onTitle={(next) => setDayField(day.day, "title", next)}
            onBase={(next) => setDayField(day.day, "base", next)}
          />
        )}

        {page.showImage ? (
          <Removable
            editable={isEdit}
            hidden={hidden(`${dayKey}:image`)}
            onToggle={() => toggle(`${dayKey}:image`)}
            label="day image"
            className="rc-doc-day-image-slot"
          >
            <div className="rc-doc-day-image">
              <div className="rc-doc-img-frame rc-doc-day-img-frame">
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

        {page.rows.length ? (
          <DaySchedule
            rows={page.rows}
            editable={isEdit}
            onCommit={(key, next) => setDayField(day.day, key, next)}
          />
        ) : (
          <p className="rc-doc-empty-page-note">Schedule continues on notes.</p>
        )}

        {page.type !== "day-plan-continuation" ? (
          <AnchorSlot
            anchor={dayKey}
            itinerary={itinerary}
            editable={isEdit}
            patch={patch}
          />
        ) : null}
      </section>
    );
  };

  const renderDayNotes = (
    page: Extract<PdfPage, { type: "day-notes" }>,
    index: number,
  ) => {
    const day = itinerary.days[page.dayIndex];
    const dayKey = `day:${day.day}`;
    const firstChunk = page.notes.some((note) => note.chunkIndex === 0);
    return (
      <section
        key={`page-${index}-day-notes-${day.day}`}
        className="rc-print-page rc-doc-day-page rc-doc-day-notes-page"
      >
        {firstChunk ? (
          <DayHeader
            day={day}
            editable={isEdit}
            onTitle={(next) => setDayField(day.day, "title", next)}
            onBase={(next) => setDayField(day.day, "base", next)}
            titleSuffix="Good to know"
          />
        ) : (
          <ContinuationHeader
            label={`Day ${String(day.day).padStart(2, "0")} notes continued`}
          />
        )}
        <Removable
          editable={isEdit}
          hidden={hidden(`${dayKey}:notes`)}
          onToggle={() => toggle(`${dayKey}:notes`)}
          label="notes"
          className="rc-doc-day-notes-slot"
        >
          <div className="rc-doc-section rc-day-notes">
            <p className="rc-doc-eyebrow">Good to know</p>
            <div className="rc-day-notes-grid">
              {page.notes.map((note) => (
                <DayNote
                  key={`${note.key}-${note.chunkIndex}`}
                  note={note}
                  editable={isEdit}
                  onCommit={(key, next) => setDayField(day.day, key, next)}
                />
              ))}
            </div>
          </div>
        </Removable>
      </section>
    );
  };

  const renderDetails = (
    page: Extract<PdfPage, { type: "local-details" }>,
    index: number,
  ) => {
    const day = itinerary.days[page.dayIndex];
    const dayKey = `day:${day.day}`;
    const detailsKey = `${dayKey}:details`;
    const details = day.details;
    if (!details) return null;
    const filledSections = DETAIL_SECTIONS.filter((s) => details[s.key].length);
    const hasTrivia = Boolean(details.trivia.length);
    return (
      <section
        key={`page-${index}-details-${day.day}`}
        className="rc-print-page rc-doc-day-details-page"
      >
        {isEdit ? (
          <button
            type="button"
            onClick={() => toggle(detailsKey)}
            className="rc-edit-only rc-remove-btn rc-remove-day"
            title={`Remove Day ${day.day} local details`}
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
        <p className="rc-doc-eyebrow">
          Local details{day.base ? ` - ${day.base}` : ""}
        </p>
        <div className="rc-doc-rule rc-doc-title-rule" />
        <h3 className="rc-doc-page-title">Where to eat, stay &amp; explore</h3>
        <div className="rc-detail-list">
          {filledSections.map((section) => (
            <Removable
              key={section.key}
              editable={isEdit}
              hidden={hidden(`${detailsKey}:${section.key}`)}
              onToggle={() => toggle(`${detailsKey}:${section.key}`)}
              label={section.label}
            >
              <div className="rc-doc-section rc-detail-section">
                <p className="rc-doc-eyebrow">{section.label}</p>
                <div className="rc-detail-items">
                  {details[section.key].map((item, itemIndex) => {
                    const meta = [item.area, item.category, item.priceBand]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <div key={itemIndex} className="rc-detail-item">
                        <EditableText
                          as="p"
                          value={item.name}
                          editable={isEdit}
                          placeholder="Name"
                          onCommit={(next) =>
                            setDetailField(
                              day.day,
                              section.key,
                              itemIndex,
                              "name",
                              next,
                            )
                          }
                          className="rc-detail-name"
                        />
                        {meta ? <p className="rc-detail-meta">{meta}</p> : null}
                        {item.whyItFits || isEdit ? (
                          <EditableText
                            as="p"
                            value={item.whyItFits}
                            editable={isEdit}
                            placeholder="Why it fits"
                            onCommit={(next) =>
                              setDetailField(
                                day.day,
                                section.key,
                                itemIndex,
                                "whyItFits",
                                next,
                              )
                            }
                            className="rc-detail-why"
                          />
                        ) : null}
                        {item.caveat ? (
                          <p className="rc-detail-caveat">{item.caveat}</p>
                        ) : null}
                        {item.source ? (
                          <p className="rc-detail-source">Source: {item.source}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Removable>
          ))}

          {hasTrivia ? (
            <Removable
              editable={isEdit}
              hidden={hidden(`${detailsKey}:trivia`)}
              onToggle={() => toggle(`${detailsKey}:trivia`)}
              label="local trivia"
            >
              <div className="rc-doc-section rc-detail-section">
                <p className="rc-doc-eyebrow">Local trivia</p>
                <ul className="rc-detail-trivia-list">
                  {details.trivia.map((item, itemIndex) => (
                    <li key={itemIndex} className="rc-detail-trivia">
                      <EditableText
                        as="span"
                        value={item.text}
                        editable={isEdit}
                        placeholder="Trivia"
                        onCommit={(next) =>
                          setTriviaText(day.day, itemIndex, next)
                        }
                      />
                      {item.source ? (
                        <span className="rc-detail-source"> - {item.source}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </Removable>
          ) : null}
        </div>
        <AnchorSlot
          anchor={detailsKey}
          itinerary={itinerary}
          editable={isEdit}
          patch={patch}
        />
      </section>
    );
  };

  const renderGuides = (
    page: Extract<PdfPage, { type: "guides" | "guides-continuation" }>,
    index: number,
  ) => (
    <section
      key={`page-${index}-${page.type}`}
      className={`rc-print-page rc-doc-guides-page${
        page.type === "guides-continuation" ? " rc-doc-continuation-page" : ""
      }`}
    >
      {page.type === "guides" ? (
        <>
          <p className="rc-doc-eyebrow">Plan with confidence</p>
          <div className="rc-doc-rule rc-doc-title-rule" />
          <h2 className="rc-doc-page-title">Guides &amp; checklists</h2>
        </>
      ) : (
        <ContinuationHeader label="Guides & checklists continued" />
      )}
      <div className="rc-doc-guide-list">
        {page.guides.map((guide) => (
          <GuideBlock
            key={`${guide.key}-${guide.chunkIndex}`}
            guide={guide}
            editable={isEdit && guide.chunkCount === 1}
            onCommit={(key, next) => setField(key, next)}
          />
        ))}
      </div>
      {page.type === "guides" ? (
        <AnchorSlot
          anchor="guides"
          itinerary={itinerary}
          editable={isEdit}
          patch={patch}
        />
      ) : null}
    </section>
  );

  const renderClosing = (index: number) => (
    <section
      key={`page-${index}-closing`}
      className="rc-print-page rc-doc-closing-page"
    >
      <div className="rc-doc-rule" />
      <p className="rc-doc-closing-title">
        {businessName || "Thank you & safe travels"}
      </p>
      <EditableText
        as="p"
        value={disclaimer}
        editable={isEdit}
        onCommit={(next) => setField("verificationNotes", next)}
        className="rc-doc-disclaimer"
      />
      <AnchorSlot
        anchor="closing"
        itinerary={itinerary}
        editable={isEdit}
        patch={patch}
      />
    </section>
  );

  return (
    <div
      ref={ref}
      className={`rc-doc rc-print-root${isEdit ? " rc-doc-editing" : ""}`}
      style={themeVars(theme)}
    >
      {pages.map(renderPage)}
      {isEdit
        ? itinerary.days.map((day) =>
            hidden(`day:${day.day}`) ? (
              <section
                key={`restore-day-${day.day}`}
                className="rc-print-page rc-doc-day-page rc-edit-only rc-doc-restore-page"
              >
                <button
                  type="button"
                  onClick={() => toggle(`day:${day.day}`)}
                  className="rc-restore-bar"
                  title={`Restore day ${day.day}`}
                >
                  <Eye className="size-3.5" />
                  Restore Day {day.day}
                </button>
              </section>
            ) : null,
          )
        : null}
    </div>
  );
});

function DayHeader({
  day,
  editable,
  onTitle,
  onBase,
  titleSuffix,
}: {
  day: ItineraryOutput["days"][number];
  editable: boolean;
  onTitle: (next: string) => void;
  onBase: (next: string) => void;
  titleSuffix?: string;
}) {
  return (
    <div className="rc-doc-day-header">
      <div className="rc-doc-day-heading">
        <p className="rc-doc-eyebrow">
          Day {String(day.day).padStart(2, "0")}
        </p>
        <EditableText
          as="h3"
          value={titleSuffix ?? day.title}
          editable={editable && !titleSuffix}
          placeholder="Day title"
          onCommit={onTitle}
          className="rc-doc-day-title"
        />
        {day.base || editable ? (
          <EditableText
            as="p"
            value={day.base}
            editable={editable}
            placeholder="Base city"
            onCommit={onBase}
            className="rc-doc-day-base"
          />
        ) : null}
      </div>
      <span className="rc-day-num">{day.day}</span>
    </div>
  );
}

function ContinuationHeader({ label }: { label: string }) {
  return (
    <div className="rc-doc-continuation-header">
      <p className="rc-doc-eyebrow">{label}</p>
      <div className="rc-doc-hairline" />
    </div>
  );
}

function DaySchedule({
  rows,
  editable,
  onCommit,
}: {
  rows: PdfDayRow[];
  editable: boolean;
  onCommit: (key: DayTimeKey, next: string) => void;
}) {
  return (
    <div className="rc-doc-day-schedule">
      {rows.map((row) => (
        <div
          key={`${row.key}-${row.chunkIndex}`}
          className={`rc-day-row${row.continuationRow ? " is-continuation" : ""}`}
        >
          <div className="rc-day-row-label">
            {row.label}
            {row.chunkCount > 1 ? (
              <span className="rc-row-part">
                {row.chunkIndex + 1}/{row.chunkCount}
              </span>
            ) : null}
          </div>
          <EditableText
            as="div"
            value={row.value}
            editable={editable && row.chunkCount === 1}
            placeholder={`${row.label}...`}
            onCommit={(next) => onCommit(row.key, next)}
            className="rc-day-row-body"
          />
        </div>
      ))}
    </div>
  );
}

function DayNote({
  note,
  editable,
  onCommit,
}: {
  note: PdfDayNote;
  editable: boolean;
  onCommit: (key: DayNoteKey, next: string) => void;
}) {
  return (
    <div
      className={`rc-day-note${
        note.conclusion ? " rc-day-note-conclusion" : ""
      }`}
    >
      <span className="rc-day-note-label">
        {note.label}
        {note.chunkCount > 1
          ? ` ${note.chunkIndex + 1}/${note.chunkCount}`
          : ""}
        :{" "}
      </span>
      <EditableText
        as="span"
        value={note.value}
        editable={editable && note.chunkCount === 1}
        onCommit={(next) => onCommit(note.key, next)}
        className="rc-day-note-body"
      />
    </div>
  );
}

function GuideBlock({
  guide,
  editable,
  onCommit,
}: {
  guide: PdfTextBlock<GuideKey>;
  editable: boolean;
  onCommit: (key: GuideKey, next: string) => void;
}) {
  return (
    <div className="rc-doc-section rc-guide-section">
      <h3 className="rc-guide-title">
        {guide.label}
        {guide.chunkCount > 1 ? (
          <span className="rc-guide-part">
            {guide.chunkIndex + 1}/{guide.chunkCount}
          </span>
        ) : null}
      </h3>
      <div className="rc-doc-hairline" />
      <EditableText
        as="p"
        value={guide.value}
        editable={editable}
        onCommit={(next) => onCommit(guide.key, next)}
        className="rc-guide-body"
      />
    </div>
  );
}
