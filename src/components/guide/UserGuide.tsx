"use client";

import * as React from "react";
import Link from "next/link";
import {
  SlidersHorizontal,
  Grid3x3,
  Map,
  BadgeDollarSign,
  Download,
  BookOpen,
  Sparkles,
  Wand2,
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

interface StageInfo {
  icon: LucideIcon;
  name: string;
  summary: string;
  actions: string[];
  readiness: string[];
  pitfalls: string[];
}

const STAGES: StageInfo[] = [
  {
    icon: SlidersHorizontal,
    name: "1. Define the Product",
    summary:
      "Turn the travel idea into a commercial brief before generating content.",
    actions: [
      "Choose Digital download, Custom service, or Hybrid",
      "Set channels, destination, buyer, positioning, brand voice, and trip brief",
      "Select only the outputs you intend to finish",
    ],
    readiness: [
      "Destination, buyer, positioning, trip configuration, and channels are present",
      "Marketplace listing remains selected because every offer needs a sales page",
    ],
    pitfalls: [
      "Extra selected outputs become later publish work",
      "Service and hybrid offers need intake and package details later",
    ],
  },
  {
    icon: Grid3x3,
    name: "2. Plan the Editions",
    summary: "Commit to the exact duration and traveler combinations you will ship.",
    actions: [
      "Add the first duration and traveler type combination",
      "Use custom days only when a standard duration label is not precise enough",
      "Review route concepts as inspiration",
    ],
    readiness: [
      "At least one planned edition exists",
      "Each edition becomes a required itinerary in Build",
    ],
    pitfalls: [
      "Broad duration ideas do not count until they are added as editions",
      "More editions mean more launch blockers until completed or removed",
    ],
  },
  {
    icon: Map,
    name: "3. Build the Itineraries",
    summary: "Complete one linked itinerary for every planned edition.",
    actions: [
      "Create the editable day-by-day foundation for each edition",
      "Complete Overview, Days, Included guides, and Quality notes",
      "Use the edition checklist to separate blockers from recommendations",
    ],
    readiness: [
      "Every planned edition has a linked itinerary with the exact day count",
      "Title, overview, audience, route summary, day titles, bases, activities, selected guides, and verification notes are complete",
    ],
    pitfalls: [
      "Rainy-day alternatives and booking notes improve quality but are recommendations",
      "Itineraries are linked by edition id, not by matching text labels",
    ],
  },
  {
    icon: BadgeDollarSign,
    name: "4. Package the Offer",
    summary: "Make the itinerary easy to understand, buy, and deliver.",
    actions: [
      "Finish listing titles, tags, descriptions, and delivery notes",
      "Add service packages and buyer requirements for service or hybrid offers",
      "Build selected visuals, PDF, spreadsheet, exports, and production prompts",
    ],
    readiness: [
      "Listing fields are complete",
      "Portfolio visuals have five final briefs when selected",
      "Selected delivery outputs have completed itinerary content to draw from",
    ],
    pitfalls: [
      "Package tools do not replace missing itinerary content",
      "Generated visual images are recommended, but finalized briefs are the blocker",
    ],
  },
  {
    icon: Download,
    name: "5. Review and Publish",
    summary: "Resolve launch blockers and make the final manual confirmations.",
    actions: [
      "Follow direct links from each issue to the exact stage, edition, or tool",
      "Verify live-data language, review files, download a backup, and mark ready",
    ],
    readiness: [
      "No blockers remain",
      "Live-data, presentation, and JSON backup confirmations are checked",
    ],
    pitfalls: [
      "Readiness-sensitive edits clear final confirmations",
      "Publish cannot verify live prices, hours, tickets, or availability for you",
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
                "Choose the offer model, sales channels, output package, and brand voice.",
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
              Each project opens into a five-stage production route. The stages stay
              flexible, while the route line and recommended action answer{" "}
              <span className="font-medium text-ink">
                what must I do next to produce something I can sell?
              </span>
              {" "}Progress is derived from useful content checks rather than manual
              completion toggles.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  k: "Recommended next move",
                  v: "The workspace opens the earliest incomplete stage and explains why it matters.",
                },
                {
                  k: "Shareable task links",
                  v: "Stage, edition, and package tool are stored in the URL so a refresh returns to the same task.",
                },
                {
                  k: "Blockers vs. improvements",
                  v: "Publish separates launch blockers from quality recommendations you can handle later.",
                },
              ].map((row) => (
                <div
                  key={row.k}
                  className="border border-border-soft bg-paper-2/40 p-4"
                >
                  <p className="text-sm font-semibold text-ink">{row.k}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {row.v}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {STAGES.map((stage) => {
                const Icon = stage.icon;
                return (
                  <div
                    key={stage.name}
                    className="border border-border-soft bg-paper p-5 shadow-[var(--shadow-soft)]"
                  >
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-9 items-center justify-center rounded-xl bg-sage-soft text-forest">
                            <Icon className="size-4" />
                          </span>
                          <p className="font-display text-lg font-semibold text-ink">
                            {stage.name}
                          </p>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                          {stage.summary}
                        </p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                            Do
                          </p>
                          <Bullets items={stage.actions} />
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                            Progress
                          </p>
                          <Bullets items={stage.readiness} />
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                            Watch
                          </p>
                          <Bullets items={stage.pitfalls} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Callout tone="tip" title="Selected outputs drive requirements">
              Only the outputs selected in Define become Package and Publish work.
              Marketplace listing is always required; legacy Map Pins can appear
              on imports but do not block publishing.
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
                "Open Project actions or Review and Publish, then download the project JSON.",
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
