import type { ItineraryOutput } from "@/lib/types";
import { isHidden } from "./doc-editing";

export const PDF_PAGE_MODEL = {
  pageHeightMm: 297,
  marginTopMm: 18,
  marginBottomMm: 16,
  bodyHeightMm: 263,
  continuationBodyHeightMm: 248,
  dayHeaderMm: 34,
  continuationHeaderMm: 15,
  dayImageMm: 70,
  scheduleGapMm: 6,
  notesGapMm: 6,
  pageSafetyMm: 16,
} as const;

export type DayTimeKey =
  | "morning"
  | "lunch"
  | "afternoon"
  | "evening"
  | "dinner";

export type DayNoteKey =
  | "transportNotes"
  | "bookingNotes"
  | "optionalUpgrade"
  | "lowEnergyAlternative"
  | "rainyDayAlternative"
  | "whyThisWorks";

export type OverviewKey =
  | "overview"
  | "whoFor"
  | "routeSummary"
  | "bestStayAreas"
  | "paceStyle";

export type GuideKey =
  | "foodGuide"
  | "transportGuide"
  | "packingList"
  | "etiquetteSafety"
  | "bookingChecklist";

export interface PdfTextBlock<Key extends string = string> {
  key: Key;
  label: string;
  value: string;
  chunkIndex: number;
  chunkCount: number;
  estimatedHeightMm: number;
}

export interface PdfDayRow extends PdfTextBlock<DayTimeKey> {
  continuationRow: boolean;
}

export interface PdfDayNote extends PdfTextBlock<DayNoteKey> {
  conclusion: boolean;
}

export type DetailSectionKey = "restaurants" | "stays" | "activities" | "shopping";

export interface PdfLocalDetailSection {
  key: DetailSectionKey;
  label: string;
  itemIndexes: number[];
}

export type PdfPage =
  | {
      type: "cover";
      estimatedHeightMm: number;
    }
  | {
      type: "overview" | "overview-continuation";
      fields: PdfTextBlock<OverviewKey>[];
      estimatedHeightMm: number;
    }
  | {
      type: "day-plan" | "day-image-plan" | "day-plan-continuation";
      dayIndex: number;
      showImage: boolean;
      rows: PdfDayRow[];
      estimatedHeightMm: number;
    }
  | {
      type: "day-notes";
      dayIndex: number;
      continuation: boolean;
      notes: PdfDayNote[];
      estimatedHeightMm: number;
    }
  | {
      type: "local-details";
      dayIndex: number;
      continuation: boolean;
      sections: PdfLocalDetailSection[];
      triviaIndexes: number[];
      estimatedHeightMm: number;
    }
  | {
      type: "guides" | "guides-continuation";
      guides: PdfTextBlock<GuideKey>[];
      estimatedHeightMm: number;
    }
  | {
      type: "closing";
      estimatedHeightMm: number;
    };

const TIME_FIELDS: { key: DayTimeKey; label: string }[] = [
  { key: "morning", label: "Morning" },
  { key: "lunch", label: "Lunch" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "dinner", label: "Dinner" },
];

const NOTE_FIELDS: { key: DayNoteKey; label: string }[] = [
  { key: "transportNotes", label: "Transport" },
  { key: "bookingNotes", label: "Booking" },
  { key: "optionalUpgrade", label: "Upgrade" },
  { key: "lowEnergyAlternative", label: "Low-energy" },
  { key: "rainyDayAlternative", label: "Rainy day" },
  { key: "whyThisWorks", label: "Why it works" },
];

const GUIDE_FIELDS: { key: GuideKey; label: string }[] = [
  { key: "foodGuide", label: "Food & cafe guide" },
  { key: "transportGuide", label: "Transport guide" },
  { key: "packingList", label: "Packing list" },
  { key: "etiquetteSafety", label: "Etiquette & safety" },
  { key: "bookingChecklist", label: "Booking checklist" },
];

export const LOCAL_DETAIL_SECTIONS: {
  key: DetailSectionKey;
  label: string;
}[] = [
  { key: "restaurants", label: "Restaurants & cafes" },
  { key: "stays", label: "Stays" },
  { key: "activities", label: "Activities & experiences" },
  { key: "shopping", label: "Shopping" },
];

export function buildPdfPages(itinerary: ItineraryOutput): PdfPage[] {
  const pages: PdfPage[] = [
    {
      type: "cover",
      estimatedHeightMm: 0,
    },
  ];

  pages.push(...buildOverviewPages(itinerary));

  itinerary.days.forEach((day, dayIndex) => {
    const dayKey = `day:${day.day}`;
    if (isHidden(itinerary, dayKey)) return;

    const rows = buildDayRows(day);
    const notes = buildDayNotes(day);
    const imageVisible = Boolean(day.image) && !isHidden(itinerary, `${dayKey}:image`);
    const notesVisible =
      notes.length > 0 && !isHidden(itinerary, `${dayKey}:notes`);
    const dayPages = paginateDayPlan(dayIndex, rows, imageVisible);
    pages.push(...dayPages);
    if (notesVisible) pages.push(...paginateDayNotes(dayIndex, notes));

    const detailsKey = `${dayKey}:details`;
    if (hasDayDetails(day) && !isHidden(itinerary, detailsKey)) {
      pages.push(...paginateLocalDetails(dayIndex, day, itinerary, detailsKey));
    }
  });

  pages.push(...buildGuidePages(itinerary));
  pages.push({
    type: "closing",
    estimatedHeightMm: 42,
  });

  return pages;
}

function buildOverviewPages(itinerary: ItineraryOutput): PdfPage[] {
  const fields = [
    {
      key: "overview" as const,
      label: "Overview",
      value: itinerary.overview,
    },
    { key: "whoFor" as const, label: "Who it's for", value: itinerary.whoFor },
    { key: "routeSummary" as const, label: "Route", value: itinerary.routeSummary },
    {
      key: "bestStayAreas" as const,
      label: "Best stay areas",
      value: itinerary.bestStayAreas,
    },
    {
      key: "paceStyle" as const,
      label: "Pace & style",
      value: [itinerary.travelerType, itinerary.style, itinerary.budget]
        .filter(Boolean)
        .join(" - "),
    },
  ]
    .filter((field) => field.key === "paceStyle" || !isHidden(itinerary, field.key))
    .flatMap((field) =>
      splitBlock(field, {
        charsPerLine: field.key === "overview" ? 96 : 54,
        maxLinesPerChunk: field.key === "overview" ? 16 : 10,
        baseHeightMm: field.key === "overview" ? 8 : 9,
        lineHeightMm: field.key === "overview" ? 4.6 : 4.2,
      }),
    );

  const pages = paginateBlocks(fields, {
    firstType: "overview",
    continuationType: "overview-continuation",
    firstFixedMm: 30,
    continuationFixedMm: PDF_PAGE_MODEL.continuationHeaderMm,
    gapMm: 5,
  });

  return pages.length
    ? pages
    : [{ type: "overview", fields: [], estimatedHeightMm: 30 }];
}

function paginateDayPlan(
  dayIndex: number,
  rows: PdfDayRow[],
  showImage: boolean,
): PdfPage[] {
  const pages: PdfPage[] = [];
  let remainingRows = rows;
  let first = true;

  while (remainingRows.length || first) {
    const fixed = first
      ? PDF_PAGE_MODEL.dayHeaderMm +
        (showImage ? PDF_PAGE_MODEL.dayImageMm + PDF_PAGE_MODEL.scheduleGapMm : 0)
      : PDF_PAGE_MODEL.continuationHeaderMm;
    const capacity =
      PDF_PAGE_MODEL.bodyHeightMm - fixed - PDF_PAGE_MODEL.pageSafetyMm;
    const { selected, rest, used } = takeFittingBlocks(remainingRows, capacity);

    pages.push({
      type: first
        ? showImage
          ? "day-image-plan"
          : "day-plan"
        : "day-plan-continuation",
      dayIndex,
      showImage: first && showImage,
      rows: selected,
      estimatedHeightMm: fixed + used,
    });

    remainingRows = rest;
    first = false;
  }

  return pages;
}

function paginateDayNotes(dayIndex: number, notes: PdfDayNote[]): PdfPage[] {
  const pages: PdfPage[] = [];
  const chunks = notes.flatMap((note) => {
    if (note.estimatedHeightMm <= 62) return [note];
    return splitBlock(
      { key: note.key, label: note.label, value: note.value },
      {
        charsPerLine: note.conclusion ? 98 : 48,
        maxLinesPerChunk: note.conclusion ? 7 : 6,
        baseHeightMm: 8,
        lineHeightMm: 4.2,
      },
    ).map((chunk) => ({
      ...chunk,
      conclusion: note.conclusion,
    }));
  });
  let remaining = chunks;
  let first = true;

  while (remaining.length) {
    const fixed =
      (first ? PDF_PAGE_MODEL.dayHeaderMm : PDF_PAGE_MODEL.continuationHeaderMm) +
      PDF_PAGE_MODEL.notesGapMm +
      13;
    const capacity =
      PDF_PAGE_MODEL.bodyHeightMm - fixed - PDF_PAGE_MODEL.pageSafetyMm;
    const { selected, rest, used } = takeFittingBlocks(remaining, capacity);
    pages.push({
      type: "day-notes",
      dayIndex,
      continuation: !first,
      notes: selected,
      estimatedHeightMm: fixed + used,
    });
    remaining = rest;
    first = false;
  }

  return pages;
}

type PdfLocalDetailBlock =
  | {
      kind: "detail";
      sectionKey: DetailSectionKey;
      sectionLabel: string;
      itemIndex: number;
      estimatedHeightMm: number;
    }
  | {
      kind: "trivia";
      itemIndex: number;
      estimatedHeightMm: number;
    };

function paginateLocalDetails(
  dayIndex: number,
  day: ItineraryOutput["days"][number],
  itinerary: ItineraryOutput,
  detailsKey: string,
): PdfPage[] {
  const details = day.details;
  if (!details) return [];

  const blocks: PdfLocalDetailBlock[] = [
    ...LOCAL_DETAIL_SECTIONS.filter(
      (section) => !isHidden(itinerary, `${detailsKey}:${section.key}`),
    ).flatMap((section) =>
      details[section.key].map((item, itemIndex) => ({
        kind: "detail" as const,
        sectionKey: section.key,
        sectionLabel: section.label,
        itemIndex,
        estimatedHeightMm: estimateLocalDetailItem(item),
      })),
    ),
    ...(!isHidden(itinerary, `${detailsKey}:trivia`)
      ? details.trivia.map((item, itemIndex) => ({
          kind: "trivia" as const,
          itemIndex,
          estimatedHeightMm: estimateLocalTriviaItem(item),
        }))
      : []),
  ];

  const pages: PdfPage[] = [];
  let remaining = blocks;
  let first = true;

  while (remaining.length) {
    const fixed =
      (first ? 31 : PDF_PAGE_MODEL.continuationHeaderMm) +
      PDF_PAGE_MODEL.notesGapMm;
    const capacity =
      PDF_PAGE_MODEL.bodyHeightMm - fixed - PDF_PAGE_MODEL.pageSafetyMm;
    const { selected, rest, used } = takeFittingBlocks(remaining, capacity, 2);
    pages.push({
      type: "local-details",
      dayIndex,
      continuation: !first,
      sections: groupLocalDetailSections(selected),
      triviaIndexes: selected
        .filter((block) => block.kind === "trivia")
        .map((block) => block.itemIndex),
      estimatedHeightMm: fixed + used,
    });
    remaining = rest;
    first = false;
  }

  return pages;
}

function groupLocalDetailSections(
  blocks: PdfLocalDetailBlock[],
): PdfLocalDetailSection[] {
  const sections = new Map<DetailSectionKey, PdfLocalDetailSection>();
  for (const block of blocks) {
    if (block.kind !== "detail") continue;
    const current =
      sections.get(block.sectionKey) ??
      ({
        key: block.sectionKey,
        label: block.sectionLabel,
        itemIndexes: [],
      } satisfies PdfLocalDetailSection);
    current.itemIndexes.push(block.itemIndex);
    sections.set(block.sectionKey, current);
  }
  return [...sections.values()];
}

function estimateLocalDetailItem(
  item: NonNullable<
    ItineraryOutput["days"][number]["details"]
  >["restaurants"][number],
): number {
  const lines = estimateLines(
    [
      item.name,
      item.area,
      item.category,
      item.priceBand,
      item.whyItFits,
      item.caveat,
      item.source,
    ]
      .filter(Boolean)
      .join(" "),
    58,
  );
  return 13 + Math.max(1, lines) * 3.8;
}

function estimateLocalTriviaItem(
  item: NonNullable<ItineraryOutput["days"][number]["details"]>["trivia"][number],
): number {
  const lines = estimateLines([item.text, item.source].filter(Boolean).join(" "), 72);
  return 9 + Math.max(1, lines) * 3.8;
}

function buildGuidePages(itinerary: ItineraryOutput): PdfPage[] {
  const guides = GUIDE_FIELDS.filter(
    (guide) => !isHidden(itinerary, `guide:${guide.key}`),
  ).flatMap((guide) =>
    splitBlock(
      {
        ...guide,
        value: (itinerary[guide.key] as string) ?? "",
      },
      {
        charsPerLine: 92,
        maxLinesPerChunk: 14,
        baseHeightMm: 12,
        lineHeightMm: 4,
      },
    ),
  );

  return paginateBlocks(guides, {
    firstType: "guides",
    continuationType: "guides-continuation",
    firstFixedMm: 31,
    continuationFixedMm: PDF_PAGE_MODEL.continuationHeaderMm,
    gapMm: 6,
  });
}

function buildDayRows(day: ItineraryOutput["days"][number]): PdfDayRow[] {
  return TIME_FIELDS.flatMap((field) =>
    splitBlock(
      {
        key: field.key,
        label: field.label,
        value: (day[field.key] as string) ?? "",
      },
      {
        charsPerLine: 82,
        maxLinesPerChunk: 6,
        baseHeightMm: 8.5,
        lineHeightMm: 5.1,
      },
    ).map((chunk) => ({
      ...chunk,
      continuationRow: chunk.chunkIndex > 0,
    })),
  );
}

function buildDayNotes(day: ItineraryOutput["days"][number]): PdfDayNote[] {
  return NOTE_FIELDS.flatMap((field) =>
    splitBlock(
      {
        key: field.key,
        label: field.label,
        value: (day[field.key] as string) ?? "",
      },
      {
        charsPerLine: field.key === "whyThisWorks" ? 98 : 48,
        maxLinesPerChunk: field.key === "whyThisWorks" ? 7 : 6,
        baseHeightMm: 8,
        lineHeightMm: 4.2,
      },
    ).map((chunk) => ({
      ...chunk,
      conclusion: field.key === "whyThisWorks",
    })),
  );
}

function splitBlock<Key extends string>(
  field: { key: Key; label: string; value: string },
  options: {
    charsPerLine: number;
    maxLinesPerChunk: number;
    baseHeightMm: number;
    lineHeightMm: number;
  },
): PdfTextBlock<Key>[] {
  const value = String(field.value ?? "").trim();
  if (!value) return [];

  const maxChars = Math.max(
    options.charsPerLine,
    options.charsPerLine * options.maxLinesPerChunk,
  );
  const chunks = splitTextByParagraph(value, maxChars);

  return chunks.map((chunk, index) => {
    const lines = estimateLines(chunk, options.charsPerLine);
    return {
      key: field.key,
      label: field.label,
      value: chunk,
      chunkIndex: index,
      chunkCount: chunks.length,
      estimatedHeightMm:
        options.baseHeightMm + Math.max(1, lines) * options.lineHeightMm,
    };
  });
}

function paginateBlocks<
  Item extends PdfTextBlock,
  FirstType extends PdfPage["type"],
  ContinuationType extends PdfPage["type"],
>(
  blocks: Item[],
  options: {
    firstType: FirstType;
    continuationType: ContinuationType;
    firstFixedMm: number;
    continuationFixedMm: number;
    gapMm: number;
  },
): PdfPage[] {
  const pages: PdfPage[] = [];
  let remaining = blocks;
  let first = true;

  while (remaining.length) {
    const fixed = first ? options.firstFixedMm : options.continuationFixedMm;
    const capacity =
      PDF_PAGE_MODEL.bodyHeightMm - fixed - PDF_PAGE_MODEL.pageSafetyMm;
    const { selected, rest, used } = takeFittingBlocks(
      remaining,
      capacity,
      options.gapMm,
    );
    const page = {
      type: (first ? options.firstType : options.continuationType) as string,
      estimatedHeightMm: fixed + used,
    };

    if (page.type === "overview" || page.type === "overview-continuation") {
      pages.push({ ...page, type: page.type, fields: selected } as PdfPage);
    } else {
      pages.push({ ...page, type: page.type, guides: selected } as PdfPage);
    }

    remaining = rest;
    first = false;
  }

  return pages;
}

function takeFittingBlocks<Item extends { estimatedHeightMm: number }>(
  blocks: Item[],
  capacityMm: number,
  gapMm = 0,
): { selected: Item[]; rest: Item[]; used: number } {
  const selected: Item[] = [];
  let used = 0;
  for (const block of blocks) {
    const next = used + block.estimatedHeightMm + (selected.length ? gapMm : 0);
    if (selected.length && next > capacityMm) break;
    selected.push(block);
    used = next;
    if (next > capacityMm) break;
  }
  return {
    selected,
    rest: blocks.slice(selected.length),
    used,
  };
}

function splitTextByParagraph(text: string, maxChars: number): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    const pieces =
      paragraph.length > maxChars
        ? splitLongParagraph(paragraph, maxChars)
        : [paragraph];
    for (const piece of pieces) {
      const next = current ? `${current}\n\n${piece}` : piece;
      if (current && next.length > maxChars) {
        chunks.push(current);
        current = piece;
      } else {
        current = next;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, maxChars)];
}

function splitLongParagraph(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    const pieces =
      word.length > maxChars
        ? word.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [word]
        : [word];
    for (const piece of pieces) {
      if (piece.length === maxChars) {
        if (current) {
          chunks.push(current);
          current = "";
        }
        chunks.push(piece);
        continue;
      }

      const next = current ? `${current} ${piece}` : piece;
      if (current && next.length > maxChars) {
        chunks.push(current);
        current = piece;
      } else {
        current = next;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function estimateLines(text: string, charsPerLine: number): number {
  return text
    .split(/\n/)
    .reduce(
      (total, line) =>
        total + Math.max(1, Math.ceil(line.trim().length / charsPerLine)),
      0,
    );
}

function hasDayDetails(day: ItineraryOutput["days"][number]): boolean {
  const details = day.details;
  if (!details) return false;
  return Boolean(
    details.restaurants.length ||
      details.stays.length ||
      details.activities.length ||
      details.shopping.length ||
      details.trivia.length,
  );
}
