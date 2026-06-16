"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Copy,
  ImageIcon,
  Loader2,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import type { AiResult, AiTaskType, AiTextRequest } from "@/lib/ai/types";
import { requestAiImage, requestAiText } from "@/lib/ai/client";
import { AI_PROVIDERS, providerSupports } from "@/lib/ai/providers";
import { useAiSettingsStore } from "@/lib/store/ai-settings-store";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { AiCostBadge } from "./AiCostButton";
import { useAiConfig } from "./AiConfigProvider";
import { resolveClientAiRun } from "@/lib/ai/runtime";
import { estimateAiRunCost, formatCostEstimate } from "@/lib/ai/pricing";

type RunState = "idle" | "running" | "result" | "error";

export interface AiRunSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "text" | "image";
  title: string;
  description: string;
  taskType: AiTaskType;
  prompt: string;
  sourceLabel: string;
  currentText?: string;
  responseFormat?: "text" | "json";
  applyLabel?: string;
  fillEmptyLabel?: string;
  appendLabel?: string;
  validateText?: (text: string) => string | null;
  requestText?: (
    request: AiTextRequest,
    signal: AbortSignal,
  ) => Promise<AiResult>;
  onApplyText?: (
    text: string,
    result: AiResult,
    mode: "replace" | "fill-empty" | "append",
  ) => void;
  onApplyImage?: (image: string, result: AiResult) => void;
}

const progressByMode = {
  text: ["Preparing context", "Calling provider", "Validating response"],
  image: ["Preparing visual brief", "Calling image model", "Packaging image"],
};

const STRUCTURED_ITINERARY_OUTPUT_TOKENS = 12000;

export function AiRunSheet({
  open,
  onOpenChange,
  mode,
  title,
  description,
  taskType,
  prompt,
  sourceLabel,
  currentText = "",
  responseFormat,
  applyLabel = "Replace selected fields",
  fillEmptyLabel = "Fill only empty fields",
  appendLabel = "Append as notes",
  validateText,
  requestText,
  onApplyText,
  onApplyImage,
}: AiRunSheetProps) {
  const textDefaults = useAiSettingsStore((state) => state.text);
  const imageDefaults = useAiSettingsStore((state) => state.image);
  const getApiKey = useAiSettingsStore((state) => state.getApiKey);
  const { config, loading: configLoading } = useAiConfig();

  const defaults = mode === "text" ? textDefaults : imageDefaults;
  const personalKey = getApiKey(defaults.provider);
  const selection = resolveClientAiRun({
    mode,
    defaults,
    personalKey,
    serverConfig: config,
  });
  const info = AI_PROVIDERS[selection.provider];
  const supported = providerSupports(
    selection.provider,
    mode === "text" ? "text" : "image",
  );
  const textMaxOutputTokens =
    mode === "text" && taskType === "itinerary" && responseFormat === "json"
      ? Math.max(textDefaults.maxOutputTokens, STRUCTURED_ITINERARY_OUTPUT_TOKENS)
      : textDefaults.maxOutputTokens;
  const estimate =
    mode === "text"
      ? estimateAiRunCost({
          mode,
          provider: selection.provider,
          model: selection.model,
          prompt,
          taskType,
          maxOutputTokens: textMaxOutputTokens,
        })
      : estimateAiRunCost({
          mode,
          provider: selection.provider,
          model: selection.model,
          prompt,
          taskType,
          size: imageDefaults.size,
          quality: imageDefaults.quality,
        });
  const estimateLabel = formatCostEstimate(estimate);

  const [state, setState] = React.useState<RunState>("idle");
  const [result, setResult] = React.useState<AiResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );
  const [draft, setDraft] = React.useState("");
  const abortRef = React.useRef<AbortController | null>(null);

  if (!open) return null;

  function close() {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
    setResult(null);
    setError(null);
    setValidationError(null);
    setDraft("");
    onOpenChange(false);
  }

  async function run() {
    if (!selection.available) {
      setError(
        "No AI credential is available. Add a personal key in Settings or ask an administrator to configure server OpenAI.",
      );
      setState("error");
      return;
    }
    if (!supported) {
      setError(
        mode === "image"
          ? "This provider does not support image generation here."
          : "This provider does not support text generation here.",
      );
      setState("error");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setState("running");
    setError(null);
    setValidationError(null);
    setResult(null);

    try {
      const runText = requestText ?? requestAiText;
      const next =
        mode === "text"
          ? await runText(
              {
                provider: selection.provider,
                apiKey: personalKey || undefined,
                model: selection.model,
                prompt,
                taskType,
                label: title,
                source: sourceLabel,
                temperature: textDefaults.temperature,
                topP: textDefaults.topP,
                maxOutputTokens: textMaxOutputTokens,
                responseFormat,
              },
              controller.signal,
            )
          : await requestAiImage(
              {
                provider: selection.provider,
                apiKey: personalKey || undefined,
                model: selection.model,
                prompt,
                taskType,
                label: title,
                source: sourceLabel,
                size: imageDefaults.size,
                quality: imageDefaults.quality,
                aspectRatio: imageDefaults.aspectRatio,
              },
              controller.signal,
            );
      setResult(next);
      setDraft(next.text ?? "");
      setState("result");
      if (next.text && validateText) setValidationError(validateText(next.text));
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "The request did not complete. No project content was changed.",
      );
      setState("error");
    }
  }

  function applyText(mode: "replace" | "fill-empty" | "append") {
    if (!result || !onApplyText) return;
    const issue = validateText?.(draft) ?? null;
    setValidationError(issue);
    if (issue) return;
    onApplyText(draft, { ...result, text: draft }, mode);
    close();
  }

  function applyImage() {
    if (!result?.image || !onApplyImage) return;
    onApplyImage(result.image, result);
    close();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/35 px-3 py-4 sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)] shadow-[var(--shadow-lift)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--rc-ai-border)] bg-[var(--rc-ai-gold-soft)]/50 px-5 py-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-paper text-[var(--rc-ai-brown)] shadow-[var(--shadow-soft)]">
                {mode === "image" ? (
                  <ImageIcon className="size-4" />
                ) : (
                  <Sparkles className="size-4" />
                )}
              </span>
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              <AiCostBadge estimate={estimate} />
            </div>
            <p className="max-w-2xl text-sm text-ink-soft">{description}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close AI run sheet"
            className="rounded-full p-2 text-ink-soft hover:bg-paper/70 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[calc(92dvh-96px)] overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-[var(--rc-ai-border)] bg-paper/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rc-ai-brown)]">
                  AI request estimate
                </p>
                <div className="mt-3 space-y-2 text-sm text-ink-soft">
                  <Meta label="Provider" value={info.label} />
                  <Meta label="Model" value={selection.model} />
                  <Meta label="Source" value={sourceLabel} />
                  <Meta
                    label="Credential"
                    value={
                      selection.credentialSource === "personal"
                        ? "Personal key override"
                        : selection.credentialSource === "server"
                          ? "RouteCrafter server key"
                          : "Unavailable"
                    }
                  />
                  <Meta label="Payer" value={selection.payer} />
                  <Meta label="Estimated cost" value={estimateLabel} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                  {estimate?.basis ??
                    "Pricing is unavailable for this custom or unknown model."}
                </p>
              </div>

              <div className="rounded-2xl border border-terracotta/25 bg-terracotta-soft/45 p-4 text-sm text-brown">
                <div className="flex gap-2">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  <p>
                    {selection.credentialSource === "server"
                      ? "RouteCrafter pays for this request with its server OpenAI account."
                      : "This request may charge your personal provider account."}{" "}
                    The estimate may change with actual token usage and provider
                    pricing. Nothing is applied until you review the result.
                  </p>
                </div>
              </div>

              {!selection.available && !configLoading ? (
                <Link
                  href="/settings"
                  className="inline-flex w-full items-center justify-center rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-paper hover:bg-forest-deep"
                >
                  Add personal key in Settings
                </Link>
              ) : null}
            </aside>

            <section className="space-y-4">
              {state === "idle" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border-soft bg-paper p-4">
                    <p className="mb-2 text-sm font-semibold text-ink">
                      What will be sent
                    </p>
                    <Textarea value={prompt} readOnly rows={12} />
                  </div>
                  {!supported ? (
                    <InlineError message="This provider does not support this AI action. Change provider in Settings." />
                  ) : null}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="ghost" onClick={close}>
                      Discard
                    </Button>
                    <Button
                      onClick={run}
                      disabled={
                        configLoading || !selection.available || !supported
                      }
                    >
                      <Sparkles className="size-4" />
                      Confirm run - {estimateLabel}
                    </Button>
                  </div>
                </div>
              ) : null}

              {state === "running" ? (
                <div className="rounded-2xl border border-[var(--rc-ai-border)] bg-paper p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                    <Loader2 className="size-4 animate-spin text-[var(--rc-ai-brown)]" />
                    Running AI request
                  </div>
                  <div className="space-y-2">
                    {progressByMode[mode].map((step, index) => (
                      <div
                        key={step}
                        className="overflow-hidden rounded-xl border border-border-soft bg-paper-2/60 p-3"
                      >
                        <div
                          className={cn(
                            "h-1 rounded-full bg-[var(--rc-ai-gold)]",
                            index === 1 && "animate-pulse",
                          )}
                        />
                        <p className="mt-2 text-sm text-ink-soft">{step}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="mt-5"
                    onClick={() => abortRef.current?.abort()}
                  >
                    Cancel request
                  </Button>
                </div>
              ) : null}

              {state === "error" && error ? <InlineError message={error} /> : null}

              {state === "result" && result ? (
                <div className="space-y-4">
                  {mode === "text" ? (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <PreviewBlock title="Current content" value={currentText} />
                      <div className="rounded-2xl border border-[var(--rc-ai-border)] bg-paper p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">
                            AI proposal
                          </p>
                          <CopyButton value={draft} />
                        </div>
                        <Textarea
                          value={draft}
                          rows={16}
                          onChange={(event) => {
                            const next = event.target.value;
                            setDraft(next);
                            setValidationError(validateText?.(next) ?? null);
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[var(--rc-ai-border)] bg-paper p-4">
                      <p className="mb-3 text-sm font-semibold text-ink">
                        AI image proposal
                      </p>
                      {result.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={result.image}
                          alt="AI generated RouteCrafter visual"
                          className="max-h-[520px] w-full rounded-xl object-contain"
                        />
                      ) : null}
                    </div>
                  )}

                  {validationError ? (
                    <InlineError message={validationError} />
                  ) : (
                    <div className="flex items-center gap-2 rounded-2xl border border-sage/40 bg-sage-soft/60 p-3 text-sm text-forest">
                      <Check className="size-4" />
                      Ready to apply after your review.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="ghost" onClick={close}>
                      Discard
                    </Button>
                    {mode === "text" && onApplyText ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => navigator.clipboard.writeText(draft)}
                        >
                          <Copy className="size-4" />
                          Copy result
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => applyText("append")}
                          disabled={Boolean(validationError)}
                        >
                          {appendLabel}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => applyText("fill-empty")}
                          disabled={Boolean(validationError)}
                        >
                          {fillEmptyLabel}
                        </Button>
                        <Button
                          onClick={() => applyText("replace")}
                          disabled={Boolean(validationError)}
                        >
                          {applyLabel}
                        </Button>
                      </>
                    ) : null}
                    {mode === "image" && onApplyImage ? (
                      <Button onClick={applyImage} disabled={!result.image}>
                        Apply image
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

function PreviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-paper p-4">
      <p className="mb-2 text-sm font-semibold text-ink">{title}</p>
      <Textarea value={value || "No existing content."} readOnly rows={16} />
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-terracotta/30 bg-terracotta-soft/60 p-4 text-sm text-terracotta">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
