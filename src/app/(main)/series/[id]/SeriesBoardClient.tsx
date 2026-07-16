"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Layers,
  Loader2,
  RefreshCw,
  Square,
  XCircle,
} from "lucide-react";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useAiSettingsStore } from "@/lib/store/ai-settings-store";
import { useAiConfig } from "@/components/ai/AiConfigProvider";
import {
  useSeriesJobStore,
  type CountryJob,
  type SeriesStep,
} from "@/lib/store/series-job-store";
import { reconstructJob, runCountry } from "@/lib/series/engine";
import { MultiplyDialog } from "@/components/series/MultiplyDialog";
import { useMounted } from "@/lib/hooks";
import { formatUsd } from "@/lib/ai/pricing";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * The series board: one card per country with a live step checklist, cost
 * tally, retry/cancel, and a link into each generated product. After a
 * reload it reconstructs progress from the persisted drafts.
 */
export default function SeriesBoardClient({ seriesId }: { seriesId: string }) {
  const mounted = useMounted();
  const projects = useProjectsStore((s) => s.projects);
  const liveJob = useSeriesJobStore((s) => s.jobs[seriesId]);
  const cancelJob = useSeriesJobStore((s) => s.cancelJob);
  const startJob = useSeriesJobStore((s) => s.startJob);
  const { toast } = useToast();
  const { config } = useAiConfig();
  const text = useAiSettingsStore((s) => s.text);
  const getApiKey = useAiSettingsStore((s) => s.getApiKey);
  const [addOpen, setAddOpen] = React.useState(false);

  const source = projects.find(
    (project) =>
      project.series?.seriesId === seriesId &&
      project.series.role === "original",
  );
  const drafts = projects.filter(
    (project) =>
      project.series?.seriesId === seriesId &&
      project.series.role === "variant",
  );

  const job =
    liveJob ?? (mounted ? reconstructJob(seriesId, source, drafts) : undefined);

  if (!mounted) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!job || (!job.countries.length && !source)) {
    return (
      <EmptyState
        icon={Layers}
        title="Series not found"
        description="This series has no products yet. Open any product and use Multiply to start one."
        action={
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-paper hover:bg-forest-deep"
          >
            <ArrowLeft className="size-4" />
            Products
          </Link>
        }
      />
    );
  }

  const running = job.status === "running";
  const totalUsd = job.countries
    .flatMap((country) => country.steps)
    .reduce((total, step) => total + estimateStepUsd(step), 0);

  function retryCountry(country: CountryJob) {
    if (!source) {
      toast("The series original is missing.", "error");
      return;
    }
    if (!liveJob) {
      // Reconstructed board: seed a live job so progress renders.
      startJob({ ...job!, status: "running" });
    }
    const personalKey = getApiKey(text.provider);
    const controller = new AbortController();
    void runCountry({
      source,
      seriesId,
      seriesName: job!.seriesName,
      country: country.country,
      config: {
        provider: personalKey ? text.provider : "openai",
        model: personalKey ? text.model : (config?.serverTextModel ?? text.model),
        apiKey: personalKey || undefined,
        withImages: false,
      },
      signal: controller.signal,
    })
      .then(() => useSeriesJobStore.getState().finishJob(seriesId))
      .catch(() => {
        // Failure state is recorded on the card.
      });
  }

  return (
    <div className="space-y-7">
      <Link
        href={source ? `/products/${source.id}` : "/"}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        {source ? source.name : "Products"}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="rc-eyebrow">Series</p>
          <h1 className="mt-2 font-display text-display text-ink">
            {job.seriesName}
          </h1>
          <p className="mt-2 max-w-xl text-body text-ink-soft">
            {job.countries.filter((item) => item.status === "done").length} of{" "}
            {job.countries.length} countries complete
            {totalUsd > 0 ? ` · ~${formatUsd(totalUsd)} spent so far` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {running ? (
            <Button variant="outline" size="sm" onClick={() => cancelJob(seriesId)}>
              <Square className="size-4" />
              Cancel remaining
            </Button>
          ) : null}
          {source ? (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Layers className="size-4" />
              Add countries
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {source ? <SourceCard name={source.name} country={source.country} id={source.id} /> : null}
        {job.countries.map((country) => (
          <CountryCard
            key={country.country}
            job={country}
            coverImage={coverFor(drafts, country)}
            onRetry={() => retryCountry(country)}
          />
        ))}
      </div>

      {source ? (
        <MultiplyDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          source={source}
        />
      ) : null}
    </div>
  );
}

function coverFor(
  drafts: ReturnType<typeof useProjectsStore.getState>["projects"],
  country: CountryJob,
): string | undefined {
  const draft = drafts.find(
    (item) => item.id === country.productId || item.country === country.country,
  );
  return (
    draft?.coverImage ||
    draft?.itineraries.find((itinerary) => itinerary.coverImage)?.coverImage ||
    undefined
  );
}

function estimateStepUsd(step: SeriesStep): number {
  // Rough live tally from recorded usage; assumes blended $3/M in, $12/M out.
  const usage = step.usage;
  if (!usage) return 0;
  return (
    ((usage.inputTokens ?? 0) * 3 + (usage.outputTokens ?? 0) * 12) / 1_000_000
  );
}

function SourceCard({
  name,
  country,
  id,
}: {
  name: string;
  country: string;
  id: string;
}) {
  return (
    <Link
      href={`/products/${id}`}
      className="rc-card flex flex-col gap-2 border-dashed p-5 transition-colors hover:border-forest/40"
    >
      <p className="rc-eyebrow">Original</p>
      <p className="text-heading font-display text-ink">{country}</p>
      <p className="line-clamp-2 text-caption text-ink-soft">{name}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-caption font-semibold text-forest">
        Open product
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}

function CountryCard({
  job,
  coverImage,
  onRetry,
}: {
  job: CountryJob;
  coverImage?: string;
  onRetry: () => void;
}) {
  return (
    <article className="rc-card flex flex-col overflow-hidden">
      <div className="relative h-24 bg-gradient-to-br from-sage/25 to-gold-soft/50">
        {coverImage ? (
          <img
            src={coverImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute left-4 top-4 rounded-full bg-paper/80 px-2.5 py-1 text-caption font-semibold text-ink backdrop-blur-sm">
          {job.country}
        </div>
        <StatusChip status={job.status} />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <ul className="space-y-1.5">
          {job.steps.map((step) => (
            <li
              key={step.id}
              className="flex items-center gap-2 text-caption text-ink-soft"
            >
              {step.status === "done" ? (
                <Check className="size-3.5 shrink-0 text-forest" aria-hidden />
              ) : step.status === "running" ? (
                <Loader2
                  className="size-3.5 shrink-0 animate-spin text-gold"
                  aria-hidden
                />
              ) : step.status === "failed" ? (
                <CircleAlert
                  className="size-3.5 shrink-0 text-terracotta"
                  aria-hidden
                />
              ) : (
                <span
                  className="size-3.5 shrink-0 rounded-full border border-border-strong"
                  aria-hidden
                />
              )}
              <span className="min-w-0 truncate">{step.label}</span>
            </li>
          ))}
        </ul>
        {job.error ? (
          <p className="text-caption leading-5 text-terracotta">{job.error}</p>
        ) : null}
        <div className="mt-auto flex items-center gap-2 pt-2">
          {job.status === "failed" ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="size-4" />
              Retry
            </Button>
          ) : null}
          {job.productId ? (
            <Link
              href={`/products/${job.productId}`}
              className="ml-auto inline-flex items-center gap-1.5 text-caption font-semibold text-forest hover:text-forest-deep"
            >
              Open product
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StatusChip({ status }: { status: CountryJob["status"] }) {
  const styles: Record<CountryJob["status"], string> = {
    queued: "bg-paper/80 text-ink-muted",
    running: "bg-gold-soft text-brown",
    done: "bg-sage-soft text-forest",
    failed: "bg-terracotta-soft text-terracotta",
    cancelled: "bg-paper/80 text-ink-muted",
  };
  const labels: Record<CountryJob["status"], string> = {
    queued: "Queued",
    running: "Generating…",
    done: "Complete",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return (
    <span
      className={cn(
        "absolute right-4 top-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm",
        styles[status],
      )}
    >
      {status === "cancelled" ? <XCircle className="size-3" aria-hidden /> : null}
      {labels[status]}
    </span>
  );
}
