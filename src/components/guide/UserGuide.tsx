"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  SlidersHorizontal,
  Wand2,
  Images,
  Grid3x3,
  Map,
  BadgeDollarSign,
  FileType,
  Download,
  BookOpen,
  Sparkles,
  Lightbulb,
  Info,
  AlertTriangle,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  label: string;
}

const SECTIONS: TocItem[] = [
  { id: "start-here", label: "Start here" },
  { id: "navigation", label: "Finding your way" },
  { id: "create", label: "Create a project" },
  { id: "workspace", label: "The workspace" },
  { id: "backup", label: "Back up & move work" },
  { id: "ai", label: "Using AI (optional)" },
  { id: "principles", label: "Principles & tips" },
];

interface TabInfo {
  icon: LucideIcon;
  name: string;
  summary: string;
  actions: string[];
  free?: string;
  ai?: string;
  exports?: string;
}

const TABS: TabInfo[] = [
  {
    icon: LayoutDashboard,
    name: "Overview",
    summary: "A read-only snapshot of your product, plus an AI-readiness check.",
    actions: [
      "Review positioning, audience, regions, durations and deliverables",
      "See whether an AI provider is connected and what to do next",
    ],
  },
  {
    icon: SlidersHorizontal,
    name: "Trip Configuration",
    summary:
      "The structured inputs that drive every other tab. Auto-saves as you type.",
    actions: [
      "Set cities, duration, traveler type, pace and budget",
      "Pick interests, food, transport and constraints",
      "List must-see and must-avoid, plus any special occasion",
    ],
    ai: "Paste a buyer's freeform brief and extract a configuration automatically.",
  },
  {
    icon: Wand2,
    name: "Prompt Studio",
    summary: "All 13 generation templates as copy-paste prompts, grouped by purpose.",
    actions: [
      "Generate one template or all of them at once",
      "Edit and copy any prompt to run in your LLM of choice",
    ],
    free: "Works with no key; export the prompts as a .txt bundle.",
    ai: "Run a prompt directly and apply with replace, fill-empty or append.",
  },
  {
    icon: Images,
    name: "Image Prompts",
    summary: "Five portfolio image briefs for your listing visuals.",
    actions: [
      "Hero, what-you'll-get, sample itinerary, beyond-the-brochure, built-around-style",
      "Regenerate a brief or mark it final",
    ],
    ai: "Improve a brief, or generate the image itself.",
    exports: "All five as Markdown.",
  },
  {
    icon: Grid3x3,
    name: "Itinerary Matrix",
    summary: "A durations x traveler-types grid of route variations.",
    actions: [
      "Edit each variation's one-line route spine",
      "Expand a cell to pre-fill and start a full itinerary",
    ],
    exports: "CSV or Markdown.",
  },
  {
    icon: Map,
    name: "Expanded Itinerary",
    summary: "Full, sellable day-by-day itineraries (you can keep several per project).",
    actions: [
      "Scaffold days from a duration, traveler type and style",
      "Edit time blocks, notes, guides and per-day backup options",
    ],
    ai: "Draft an entire itinerary or improve a single day.",
    exports: "Per-itinerary Markdown.",
  },
  {
    icon: BadgeDollarSign,
    name: "Listing Copy",
    summary: "The marketplace listing: titles, tags, descriptions, packages and FAQs.",
    actions: [
      "Generate starter copy, then set your own prices",
      "Mark ready to sell to update the project status",
    ],
    ai: "AI-improve the listing and merge into your fields.",
    exports: "Listing Markdown.",
  },
  {
    icon: FileType,
    name: "PDF Builder",
    summary: "A themed, print-ready A4 itinerary document.",
    actions: [
      "Pick a color theme and add a cover and per-day images",
      "Preview the multi-page document live before exporting",
    ],
    exports: "Download a PDF, or use the browser's Print / Save as PDF.",
  },
  {
    icon: Download,
    name: "Export",
    summary: "The hub for getting everything out of RouteCrafter.",
    actions: [
      "Full project as JSON (re-importable) or a Markdown bundle",
      "Per-artifact matrix CSV, itinerary, listing and prompt exports",
    ],
  },
];

type CalloutTone = "tip" | "note" | "warn";

const calloutStyles: Record<
  CalloutTone,
  { wrap: string; icon: LucideIcon; iconClass: string }
> = {
  tip: {
    wrap: "border-sage/40 bg-sage-soft/50",
    icon: Lightbulb,
    iconClass: "text-forest",
  },
  note: {
    wrap: "border-teal/30 bg-teal-soft/50",
    icon: Info,
    iconClass: "text-teal",
  },
  warn: {
    wrap: "border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)]",
    icon: AlertTriangle,
    iconClass: "text-[var(--rc-ai-brown)]",
  },
};

function Callout({
  tone,
  title,
  children,
}: {
  tone: CalloutTone;
  title?: string;
  children: React.ReactNode;
}) {
  const style = calloutStyles[tone];
  const Icon = style.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-sm leading-relaxed text-ink-soft",
        style.wrap,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.iconClass)} />
      <div className="space-y-1">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-semibold text-paper">
            {i + 1}
          </span>
          <span className="pt-0.5 text-sm leading-relaxed text-ink-soft">
            {item}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-ink-soft">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-terracotta" />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SubRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs leading-relaxed">
      <span className="font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </span>
      <span className="text-ink-soft">{children}</span>
    </div>
  );
}

function SectionShell({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
          {eyebrow}
        </p>
        <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function TocLinks({
  active,
  onNavigate,
  className,
}: {
  active: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={className}>
      {SECTIONS.map((item) => {
        const isActive = active === item.id;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={onNavigate}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors lg:rounded-xl lg:px-3 lg:py-2",
              isActive
                ? "bg-sage-soft text-forest"
                : "text-ink-soft hover:bg-paper-2/70 hover:text-ink",
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

export function UserGuide() {
  const [active, setActive] = React.useState<string>(SECTIONS[0].id);

  React.useEffect(() => {
    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: [0, 1] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rc-card overflow-hidden">
        <div className="h-2 w-full bg-gradient-to-r from-forest via-sage to-terracotta" />
        <div className="space-y-5 p-7 sm:p-9">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-forest text-paper shadow-[var(--shadow-soft)]">
              <BookOpen className="size-5" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
              Help &amp; documentation
            </p>
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
              RouteCrafter user guide
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">
              Everything you need to turn a destination into a finished, sellable
              itinerary product. RouteCrafter works fully without an API key &mdash;
              connect a model later only if you want in-app AI drafting.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-forest-deep"
            >
              Start a project
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#workspace"
              className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-paper px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Tour the workspace
            </a>
          </div>
        </div>
      </div>

      {/* Mobile TOC */}
      <TocLinks
        active={active}
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden"
      />

      <div className="lg:grid lg:grid-cols-[210px_1fr] lg:gap-10">
        {/* Desktop sticky TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-8 space-y-2">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              On this page
            </p>
            <TocLinks active={active} className="flex flex-col gap-1" />
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 space-y-14">
          <SectionShell
            id="start-here"
            eyebrow="Start here"
            title="What RouteCrafter does"
          >
            <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
              RouteCrafter is a studio for producing premium, country-specific
              travel itinerary products and the marketplace listing assets that
              sell them. You capture a trip once as structured configuration, then
              generate every deliverable from it &mdash; itineraries, listing copy,
              image briefs, guides and print-ready PDFs.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border-soft bg-paper-2/40 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Wand2 className="size-4 text-forest" />
                  <p className="text-sm font-semibold text-ink">
                    Prompt-output mode
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-ink-soft">
                  Always available, no key. Generate copy-paste prompts and
                  structured starter content, run them in any LLM, and paste the
                  results back into editable fields.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)] p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="size-4 text-[var(--rc-ai-brown)]" />
                  <p className="text-sm font-semibold text-ink">
                    Direct AI mode
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-ink-soft">
                  Optional. Add your own provider key in Settings and let
                  RouteCrafter draft content for you &mdash; always behind a
                  preview-before-apply confirmation.
                </p>
              </div>
            </div>
            <Callout tone="tip" title="You never need an API key">
              Every generation feature has a free, copy-paste path. AI is an
              accelerant, not a requirement.
            </Callout>
          </SectionShell>

          <SectionShell
            id="navigation"
            eyebrow="Orientation"
            title="Finding your way"
          >
            <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
              The left sidebar (or the top bar on mobile) holds the main
              destinations:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  k: "Dashboard",
                  v: "Recent projects, quick actions and project import.",
                },
                { k: "Projects", v: "The full grid of everything you've made." },
                {
                  k: "Guide",
                  v: "This page.",
                },
                {
                  k: "Settings",
                  v: "Connect AI provider keys and set model defaults.",
                },
              ].map((row) => (
                <div
                  key={row.k}
                  className="rounded-2xl border border-border-soft bg-paper-2/40 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-ink">{row.k}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
                    {row.v}
                  </p>
                </div>
              ))}
            </div>
          </SectionShell>

          <SectionShell
            id="create"
            eyebrow="Step 1"
            title="Create a project"
          >
            <Steps
              items={[
                <>
                  From the dashboard, choose{" "}
                  <Link
                    href="/projects/new"
                    className="font-medium text-forest underline-offset-2 hover:underline"
                  >
                    New project
                  </Link>
                  .
                </>,
                "Give it a name, country and the regions or cities it covers.",
                "Add your positioning (the one-line product angle) and target audience.",
                "Pick a brand voice: editorial, premium, friendly or adventurous.",
                "Submit to land in the project workspace, ready to build.",
              ]}
            />
            <Callout tone="note">
              A project starts as a Draft. You can duplicate, export or delete it
              any time from the workspace header.
            </Callout>
          </SectionShell>

          <SectionShell
            id="workspace"
            eyebrow="Step 2"
            title="The workspace"
          >
            <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
              Each project opens into a workspace with nine tabs. A typical flow is{" "}
              <span className="font-medium text-ink">
                Trip Configuration &rarr; Matrix &rarr; Expanded Itinerary &rarr;
                PDF
              </span>
              , with Listing Copy and Image Prompts produced alongside and everything
              collected in Export. Most tabs read from your Trip Configuration, so
              fill that in first.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <div
                    key={tab.name}
                    className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-paper p-5 shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-sage-soft text-forest">
                        <Icon className="size-4" />
                      </span>
                      <p className="font-display text-lg font-semibold text-ink">
                        {tab.name}
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed text-ink-soft">
                      {tab.summary}
                    </p>
                    <div className="mt-auto space-y-2.5 border-t border-border-soft pt-3">
                      <Bullets items={tab.actions} />
                      <div className="space-y-1">
                        {tab.free ? (
                          <SubRow label="No key">{tab.free}</SubRow>
                        ) : null}
                        {tab.ai ? <SubRow label="With AI">{tab.ai}</SubRow> : null}
                        {tab.exports ? (
                          <SubRow label="Export">{tab.exports}</SubRow>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Callout tone="tip" title="Jump between tabs">
              Expanding a matrix cell carries its duration and traveler type into the
              Expanded Itinerary tab, and the PDF Builder links you back to create an
              itinerary if none exists yet.
            </Callout>
          </SectionShell>

          <SectionShell
            id="backup"
            eyebrow="Keeping your work"
            title="Back up & move projects"
          >
            <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
              RouteCrafter stores everything in your browser &mdash; there is no
              account or server. JSON export and import is how you back up work and
              move it between browsers.
            </p>
            <Steps
              items={[
                "Open the Export tab (or the header Export button) and download the project JSON.",
                "On another browser, use Import project on the dashboard and pick that file.",
                "Imports are validated and never overwrite existing work: a colliding project gets a fresh id.",
              ]}
            />
            <Callout tone="warn" title="Your data is local">
              Clearing site data, switching browsers, or using a private window will
              hide or lose your projects. Export regularly if the work matters.
            </Callout>
          </SectionShell>

          <SectionShell
            id="ai"
            eyebrow="Optional"
            title="Using AI"
          >
            <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
              Direct AI is bring-your-own-key. Add a key for OpenAI, Anthropic or
              Gemini in{" "}
              <Link
                href="/settings"
                className="font-medium text-forest underline-offset-2 hover:underline"
              >
                Settings
              </Link>
              , and AI buttons across the workspace become active.
            </p>
            <Bullets
              items={[
                "Every AI run is labeled Billable and previewed before anything is applied.",
                "Apply text with replace, fill-empty or append so your edits are never lost.",
                "Structured results are validated against the data model before they can be used.",
                "Keys are stored only in this browser and are never written to a server.",
              ]}
            />
            <Callout tone="warn" title="Key safety">
              Keys are kept in this browser&apos;s local storage in plain text. Do not save
              keys on shared devices, and remove them before handing off a profile.
            </Callout>
          </SectionShell>

          <SectionShell
            id="principles"
            eyebrow="Good habits"
            title="Principles & tips"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  k: "Configure once, generate everywhere",
                  v: "Most tabs read your Trip Configuration. Invest in it first.",
                },
                {
                  k: "Treat output as a draft",
                  v: "Generated content (prompt or AI) is a starting point. Edit before you ship.",
                },
                {
                  k: "Always verify live data",
                  v: "RouteCrafter never invents prices, hours or availability. Confirm before delivery.",
                },
                {
                  k: "Keep a catalog",
                  v: "Duplicate a finished project to spin up the next destination quickly.",
                },
              ].map((row) => (
                <div
                  key={row.k}
                  className="rounded-2xl border border-border-soft bg-paper-2/40 p-5"
                >
                  <p className="text-sm font-semibold text-ink">{row.k}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {row.v}
                  </p>
                </div>
              ))}
            </div>
            <Callout tone="note" title="Looking for deeper technical docs?">
              Architecture and reference documentation lives in the project&apos;s{" "}
              <code className="rounded bg-paper-2 px-1.5 py-0.5 text-xs">docs/</code>{" "}
              folder in the repository.
            </Callout>
          </SectionShell>
        </div>
      </div>
    </div>
  );
}
