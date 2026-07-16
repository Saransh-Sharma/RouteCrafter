"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Globe2, Layers, Sparkles, X } from "lucide-react";
import type { Project } from "@/lib/types";
import { Dialog, DialogActions } from "@/components/ui/overlay/Dialog";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui";
import { useAiSettingsStore } from "@/lib/store/ai-settings-store";
import { useAiConfig } from "@/components/ai/AiConfigProvider";
import { estimateSeriesCost } from "@/lib/series/estimate";
import { runSeriesGeneration } from "@/lib/series/engine";
import { formatCostEstimate } from "@/lib/ai/pricing";
import { cn } from "@/lib/utils";

import { SUGGESTED_COUNTRIES } from "./countries";

/**
 * "Multiply" — transpose a finished product to new countries. Text
 * generation only by default; API image generation is a separate, explicit
 * opt-in with its cost itemized before anything runs.
 */
export function MultiplyDialog({
  open,
  onClose,
  source,
}: {
  open: boolean;
  onClose: () => void;
  source: Project;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { config } = useAiConfig();
  const text = useAiSettingsStore((s) => s.text);
  const image = useAiSettingsStore((s) => s.image);
  const getApiKey = useAiSettingsStore((s) => s.getApiKey);

  const [countries, setCountries] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState("");
  const [withImages, setWithImages] = React.useState(false);
  const [starting, setStarting] = React.useState(false);

  // Same credential rules as every other AI surface: a personal key keeps
  // the selected provider; otherwise the server OpenAI key (when available).
  const personalKey = getApiKey(text.provider);
  const provider = personalKey ? text.provider : "openai";
  const model = personalKey
    ? text.model
    : (config?.serverTextModel ?? text.model);
  const canRun = Boolean(personalKey || config?.serverOpenAiAvailable);
  const imageKey = getApiKey(image.provider);

  const estimate = React.useMemo(
    () =>
      countries.length
        ? estimateSeriesCost({
            source,
            countries: countries.length,
            provider,
            model,
            withImages,
            imageProvider: image.provider,
            imageModel: image.model,
            imageSize: image.size,
            imageQuality: image.quality,
          })
        : null,
    [countries.length, source, provider, model, withImages, image],
  );

  const suggestions = SUGGESTED_COUNTRIES.filter(
    (name) =>
      name.toLowerCase().includes(query.trim().toLowerCase()) &&
      !countries.includes(name) &&
      name.toLowerCase() !== source.country.toLowerCase(),
  ).slice(0, 8);

  function addCountry(name: string) {
    const trimmed = name.trim();
    if (!trimmed || countries.includes(trimmed)) return;
    if (trimmed.toLowerCase() === source.country.toLowerCase()) {
      toast("That is this product's own country", "error");
      return;
    }
    setCountries((current) => [...current, trimmed]);
    setQuery("");
  }

  function start() {
    if (!countries.length || starting) return;
    setStarting(true);
    const seriesId = source.series?.seriesId ?? crypto.randomUUID();
    const seriesName =
      source.series?.seriesName ||
      `${source.name.replace(source.country, "").replace(/\s+/g, " ").trim() || source.name} series`;
    const controller = new AbortController();

    void runSeriesGeneration({
      source,
      seriesId,
      seriesName,
      countries,
      config: {
        provider,
        model,
        apiKey: personalKey || undefined,
        withImages,
        image: withImages
          ? {
              provider: imageKey ? image.provider : "openai",
              model: imageKey
                ? image.model
                : (config?.serverImageModel ?? image.model),
              apiKey: imageKey || undefined,
              size: image.size,
              quality: image.quality,
            }
          : undefined,
      },
      signal: controller.signal,
    }).catch(() => {
      // Failures are tracked per country on the board.
    });

    onClose();
    router.push(`/series/${seriesId}`);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Multiply across countries"
      description={`Recreate “${source.name}” for other countries — same structure, editions, and voice, new destinations.`}
    >
      <div className="space-y-6">
        <div>
          <FormField
            label="Target countries"
            hint="Each becomes its own sellable product in this series."
          >
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCountry(suggestions[0] ?? query);
                }
              }}
              placeholder="Type a country and press Enter"
            />
          </FormField>
          {query && suggestions.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addCountry(name)}
                  className="rounded-full border border-border-strong px-3 py-1 text-caption font-medium text-ink-soft transition-colors hover:border-forest/40 hover:text-ink"
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
          {countries.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {countries.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1.5 text-caption font-semibold text-forest"
                >
                  <Globe2 className="size-3.5" aria-hidden />
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() =>
                      setCountries((current) =>
                        current.filter((item) => item !== name),
                      )
                    }
                    className="rounded-full p-0.5 hover:bg-paper/70"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="rc-label">Images</legend>
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border p-4 transition-colors",
              !withImages
                ? "border-forest bg-sage-soft/50"
                : "border-border-soft hover:border-forest/30",
            )}
          >
            <input
              type="radio"
              name="series-images"
              checked={!withImages}
              onChange={() => setWithImages(false)}
              className="mt-1 accent-[var(--rc-forest)]"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">
                Prompts only — recommended
              </span>
              <span className="mt-0.5 block text-caption leading-5 text-ink-soft">
                Each country gets ready-made, country-adapted image prompts.
                Copy one into ChatGPT, Gemini, or Midjourney, then upload the
                result — zero API image cost.
              </span>
            </span>
          </label>
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border p-4 transition-colors",
              withImages
                ? "border-gold bg-gold-soft/40"
                : "border-border-soft hover:border-forest/30",
            )}
          >
            <input
              type="radio"
              name="series-images"
              checked={withImages}
              onChange={() => setWithImages(true)}
              className="mt-1 accent-[var(--rc-gold)]"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">
                Generate via API
              </span>
              <span className="mt-0.5 block text-caption leading-5 text-ink-soft">
                Adds 6 billable images per country (PDF cover + 5 portfolio
                visuals). The cost below includes them.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="rounded-[var(--radius-card)] border border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--rc-ai-brown)]">
            <Sparkles className="size-4" aria-hidden />
            Estimated cost
          </div>
          {countries.length ? (
            <div className="mt-2 space-y-1 text-caption text-[var(--rc-ai-brown)]">
              <p>
                <strong>{formatCostEstimate(estimate?.total ?? null)}</strong>{" "}
                for {countries.length} countr
                {countries.length === 1 ? "y" : "ies"} (
                {formatCostEstimate(estimate?.perCountry ?? null)} each)
              </p>
              <p className="opacity-80">
                ~{estimate?.textCalls ?? 0} text calls on {model}
                {withImages
                  ? ` + ${(estimate?.imagesPerCountry ?? 0) * countries.length} images`
                  : " · no image calls"}
                {personalKey ? " · your key" : " · RouteCrafter server key"}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-caption text-[var(--rc-ai-brown)] opacity-80">
              Add at least one country to see the estimate.
            </p>
          )}
        </div>

        {!canRun ? (
          <p className="text-caption text-terracotta">
            No AI credential available. Add a provider key in Settings, or
            enable the server key.
          </p>
        ) : null}
      </div>

      <DialogActions>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!countries.length || !canRun || starting}
          onClick={start}
        >
          <Layers className="size-4" />
          {starting
            ? "Starting…"
            : `Generate ${countries.length || ""} ${countries.length === 1 ? "product" : "products"}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
