"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  ImageIcon,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import type {
  AiRequestContext,
  AiResult,
  AiTaskType,
  AiTextRequest,
  DraftProgress,
} from "@/lib/ai/types";
import { requestAiImage, requestAiText, streamAiText } from "@/lib/ai/client";
import { AI_PROVIDERS, providerSupports } from "@/lib/ai/providers";
import { useAiSettingsStore } from "@/lib/store/ai-settings-store";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { CheckboxChip, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { AiCostBadge } from "./AiCostButton";
import { useAiConfig } from "./AiConfigProvider";
import { resolveClientAiRun } from "@/lib/ai/runtime";
import { estimateAiRunCost, formatCostEstimate } from "@/lib/ai/pricing";
import { isRetryableErrorMessage } from "@/lib/ai/errors";
import { useDialogFocus } from "@/hooks/useDialogFocus";

type RunState = "idle" | "running" | "result" | "error";
type AiReviewChoice = "keep-current" | "use-ai" | "merge";

interface AiReviewRow {
  path: string;
  currentValue: unknown;
  aiValue: unknown;
}

/** A user-tunable lever (e.g. Travel style) surfaced in the run + review UI. */
export interface AiTuningControl {
  id: string;
  label: string;
  options: string[];
  value: string;
}

export interface AiRunSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "text" | "image";
  title: string;
  description: string;
  taskType: AiTaskType;
  projectId?: string;
  prompt: string;
  sourceLabel: string;
  /** Override the configured default image size (e.g. "1024x1536" for portrait). */
  imageSize?: string;
  currentText?: string;
  responseFormat?: "text" | "json";
  applyLabel?: string;
  fillEmptyLabel?: string;
  appendLabel?: string;
  /** When set, shows a "What should the AI change?" box appended to the prompt. */
  instructionsPlaceholder?: string;
  /** One-tap quick-tweak chips offered alongside the free-text instructions. */
  instructionsSuggestions?: string[];
  /** Steerable levers (e.g. style/budget/pace) shown in the run + review UI. */
  tuningControls?: AiTuningControl[];
  /** Regenerate a single day in place during review; resolves to the new value. */
  onRegenerateDay?: (
    dayIndex: number,
    ctx: AiRequestContext,
    request: AiTextRequest,
  ) => Promise<unknown>;
  validateText?: (text: string) => string | null;
  requestText?: (
    request: AiTextRequest,
    signal: AbortSignal,
    ctx?: AiRequestContext,
  ) => Promise<AiResult>;
  onApplyText?: (
    text: string,
    result: AiResult,
    mode: "replace" | "fill-empty" | "append",
  ) => void;
  onApplyImage?: (image: string, result: AiResult) => void | Promise<void>;
}

const progressByMode = {
  text: ["Preparing context", "Calling provider", "Validating response"],
  image: ["Preparing visual brief", "Calling image model", "Packaging image"],
};

const STRUCTURED_ITINERARY_OUTPUT_TOKENS = 12000;

export function AiRunSheet(props: AiRunSheetProps) {
  const { open, mode, title, taskType, prompt } = props;
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const sessionKey = `${mode}:${taskType}:${title}:${prompt}`;
  return createPortal(
    <AiRunSheetDialog key={sessionKey} {...props} />,
    document.body,
  );
}

function AiRunSheetDialog({
  onOpenChange,
  mode,
  title,
  description,
  taskType,
  projectId,
  prompt,
  sourceLabel,
  imageSize,
  currentText = "",
  responseFormat,
  applyLabel = "Replace selected fields",
  fillEmptyLabel = "Fill only empty fields",
  appendLabel = "Append as notes",
  instructionsPlaceholder,
  instructionsSuggestions,
  tuningControls,
  onRegenerateDay,
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
  const effectiveImageSize = imageSize ?? imageDefaults.size;
  const personalKey = getApiKey(defaults.provider);
  const selection = resolveClientAiRun({
    mode,
    defaults,
    personalKey,
    serverConfig: config,
  });
  const info = AI_PROVIDERS[selection.provider];

  // "What should the AI change?" — free text plus quick-tweak chips. Kept as
  // internal state (not lifted to the prompt prop) so the dialog isn't re-keyed
  // and remounted on every keystroke. See sessionKey in AiRunSheet.
  const [instructions, setInstructions] = React.useState("");
  const [tweaks, setTweaks] = React.useState<string[]>([]);
  const [tuning, setTuning] = React.useState<Record<string, string>>(() =>
    Object.fromEntries((tuningControls ?? []).map((c) => [c.id, c.value])),
  );
  const changeRequest = [...tweaks, instructions.trim()]
    .filter(Boolean)
    .join("\n");
  const tuningOverrides = tuningControls?.length ? tuning : undefined;
  const effectivePrompt = changeRequest
    ? `${prompt}\n\nUser change request (prioritize this over the default focus):\n${changeRequest}`
    : prompt;

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
          prompt: effectivePrompt,
          taskType,
          maxOutputTokens: textMaxOutputTokens,
        })
      : estimateAiRunCost({
          mode,
          provider: selection.provider,
          model: selection.model,
          prompt: effectivePrompt,
          taskType,
          size: effectiveImageSize,
          quality: imageDefaults.quality,
        });
  const estimateLabel = formatCostEstimate(estimate);
  const imageQuality =
    mode === "image" &&
    taskType === "imageGeneration" &&
    selection.credentialSource === "server" &&
    sourceLabel !== "PDF cover" &&
    !/cover|hero/i.test(title)
      ? "low"
      : imageDefaults.quality;

  const [state, setState] = React.useState<RunState>("idle");
  const [result, setResult] = React.useState<AiResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );
  const [draft, setDraft] = React.useState("");
  const [reviewKey, setReviewKey] = React.useState(0);
  const [phase, setPhase] = React.useState(0);
  const [progress, setProgress] = React.useState<DraftProgress[]>([]);
  const abortRef = React.useRef<AbortController | null>(null);

  const totalDays = React.useMemo(() => {
    try {
      const parsed = JSON.parse(currentText || "{}") as { days?: unknown[] };
      return Array.isArray(parsed.days) ? parsed.days.length : 0;
    } catch {
      return 0;
    }
  }, [currentText]);

  const liveOutputTokens = progress.reduce(
    (total, step) => total + (step.usage?.outputTokens ?? 0),
    0,
  );

  const requestContext = React.useCallback(
    (): AiRequestContext => ({
      instructions: changeRequest || undefined,
      overrides: tuningOverrides,
      onProgress: (event) =>
        setProgress((prev) => upsertProgress(prev, event)),
    }),
    [changeRequest, tuningOverrides],
  );

  const close = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    onOpenChange(false);
  }, [onOpenChange]);

  const panelRef = useDialogFocus({
    open: true,
    onClose: close,
    onCancel:
      state === "running"
        ? () => abortRef.current?.abort()
        : undefined,
  });

  function buildTextRequest(): AiTextRequest {
    return {
      provider: selection.provider,
      apiKey: personalKey || undefined,
      model: selection.model,
      prompt: effectivePrompt,
      taskType,
      projectId,
      label: title,
      source: sourceLabel,
      temperature: textDefaults.temperature,
      topP: textDefaults.topP,
      maxOutputTokens: textMaxOutputTokens,
      responseFormat,
    };
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
    setDraft("");
    setReviewKey((key) => key + 1);
    setPhase(0);
    setProgress([]);

    try {
      const runText: (
        request: AiTextRequest,
        signal: AbortSignal,
        ctx?: AiRequestContext,
      ) => Promise<AiResult> = requestText ?? requestAiText;
      const textRequest = mode === "text" ? buildTextRequest() : null;
      const next =
        mode === "text" && textRequest
          ? !requestText && responseFormat !== "json"
            ? await streamAiText(textRequest, {
                signal: controller.signal,
                onToken: (token) => setDraft((current) => current + token),
                onEvent: (event) => {
                  if (event.type !== "phase") return;
                  setPhase(
                    event.phase === "preparing"
                      ? 0
                      : event.phase === "calling-provider"
                        ? 1
                        : 2,
                  );
                },
              })
            : await runText(textRequest, controller.signal, requestContext())
          : await requestAiImage(
              {
                provider: selection.provider,
                apiKey: personalKey || undefined,
                model: selection.model,
                prompt,
                taskType,
                projectId,
                label: title,
                source: sourceLabel,
                size: effectiveImageSize,
                quality: imageQuality,
                aspectRatio: imageDefaults.aspectRatio,
              },
              controller.signal,
            );
      setResult(next);
      setDraft((current) => next.text ?? current);
      setReviewKey((key) => key + 1);
      setPhase(2);
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

  async function applyImage() {
    if (!result?.image || !onApplyImage) return;
    try {
      await onApplyImage(result.image, result);
      close();
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : "The image could not be applied. The generated result is still available.",
      );
      setState("result");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/35 px-3 py-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-run-sheet-title"
      aria-describedby="ai-run-sheet-description"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[92dvh] w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)] shadow-[var(--shadow-lift)] outline-none"
        onClick={(event) => event.stopPropagation()}
      >
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
              <h2 id="ai-run-sheet-title" className="text-lg font-semibold text-ink">
                {title}
              </h2>
              <AiCostBadge estimate={estimate} />
            </div>
            <p id="ai-run-sheet-description" className="max-w-2xl text-sm text-ink-soft">
              {description}
            </p>
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
                  {liveOutputTokens > 0 ? (
                    <Meta
                      label="Output tokens so far"
                      value={liveOutputTokens.toLocaleString()}
                    />
                  ) : null}
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
                  {tuningControls?.length ? (
                    <TuningRow
                      controls={tuningControls}
                      values={tuning}
                      onChange={(id, value) =>
                        setTuning((prev) => ({ ...prev, [id]: value }))
                      }
                    />
                  ) : null}
                  {instructionsPlaceholder ? (
                    <div className="space-y-3 rounded-2xl border border-[var(--rc-ai-border)] bg-[var(--rc-ai-gold-soft)]/35 p-4">
                      <div className="flex items-baseline gap-2">
                        <Sparkles className="size-4 shrink-0 translate-y-0.5 text-[var(--rc-ai-brown)]" />
                        <div>
                          <label
                            htmlFor="ai-change-request"
                            className="rc-label"
                          >
                            What should the AI change?
                          </label>
                          <p className="text-xs text-ink-muted">
                            Optional — we&apos;ll add this to the request below.
                          </p>
                        </div>
                      </div>
                      {instructionsSuggestions?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {instructionsSuggestions.map((suggestion) => (
                            <CheckboxChip
                              key={suggestion}
                              label={suggestion}
                              selected={tweaks.includes(suggestion)}
                              onToggle={(on) =>
                                setTweaks((prev) =>
                                  on
                                    ? [...prev, suggestion]
                                    : prev.filter((t) => t !== suggestion),
                                )
                              }
                            />
                          ))}
                        </div>
                      ) : null}
                      <Textarea
                        id="ai-change-request"
                        autoSize
                        rows={3}
                        placeholder={instructionsPlaceholder}
                        value={instructions}
                        onChange={(event) => setInstructions(event.target.value)}
                      />
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-border-soft bg-paper p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">
                        What will be sent
                      </p>
                      {changeRequest ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--rc-ai-border)] bg-[var(--rc-ai-gold-soft)]/60 px-2.5 py-0.5 text-xs font-medium text-[var(--rc-ai-brown)]">
                          <Sparkles className="size-3" />
                          Includes your change request
                        </span>
                      ) : null}
                    </div>
                    <Textarea value={effectivePrompt} readOnly rows={12} />
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
                    {mode === "text" && responseFormat === "json"
                      ? "Drafting your itinerary"
                      : "Running AI request"}
                  </div>
                  {mode === "text" && responseFormat === "json" ? (
                    <DraftProgressList progress={progress} totalDays={totalDays} />
                  ) : (
                    <div className="space-y-2">
                      {progressByMode[mode].map((step, index) => (
                        <div
                          key={step}
                          className="overflow-hidden rounded-xl border border-border-soft bg-paper-2/60 p-3"
                        >
                          <div
                            className={cn(
                              "h-1 rounded-full bg-[var(--rc-ai-gold)]",
                              index === phase && "animate-pulse",
                              index < phase && "bg-forest",
                            )}
                          />
                          <p className="mt-2 text-sm text-ink-soft">{step}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {mode === "text" && draft ? (
                    <div className="mt-4 rounded-2xl border border-[var(--rc-ai-border)] bg-[var(--rc-ai-gold-soft)]/25 p-4">
                      <p className="mb-2 text-sm font-semibold text-ink">
                        Streaming preview
                        <span className="ml-1 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-[var(--rc-ai-gold)]" />
                      </p>
                      <Textarea value={draft} readOnly rows={8} />
                    </div>
                  ) : null}
                  <Button
                    variant="outline"
                    className="mt-5"
                    onClick={() => abortRef.current?.abort()}
                  >
                    Cancel request
                  </Button>
                </div>
              ) : null}

              {state === "error" && error ? (
                <div className="space-y-4">
                  <InlineError message={error} />
                  <details
                    open
                    className="rounded-2xl border border-border-soft bg-paper p-4"
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-ink">
                      Prompt that will be retried
                    </summary>
                    <Textarea
                      value={effectivePrompt}
                      readOnly
                      rows={6}
                      className="mt-3"
                    />
                  </details>
                  {isRetryableErrorMessage(error) ? (
                    <p className="text-sm text-ink-muted">
                      This looks temporary. Retry without re-entering your prompt.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="ghost" onClick={close}>
                      Discard
                    </Button>
                    {isRetryableErrorMessage(error) ? (
                      <Button
                        onClick={() => {
                          void run();
                        }}
                      >
                        <Sparkles className="size-4" />
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {state === "result" && result ? (
                <div className="space-y-4">
                  {error ? <InlineError message={error} /> : null}
                  {mode === "text" ? (
                    responseFormat === "json" ? (
                      <AiReviewPanel
                        key={reviewKey}
                        currentText={currentText}
                        aiText={draft}
                        applyLabel={applyLabel}
                        fillEmptyLabel={fillEmptyLabel}
                        appendLabel={appendLabel}
                        tuningControls={tuningControls}
                        tuning={tuning}
                        onTuningChange={(id, value) =>
                          setTuning((prev) => ({ ...prev, [id]: value }))
                        }
                        instructionsPlaceholder={instructionsPlaceholder}
                        instructions={instructions}
                        onInstructionsChange={setInstructions}
                        instructionsSuggestions={instructionsSuggestions}
                        tweaks={tweaks}
                        onToggleTweak={(suggestion, on) =>
                          setTweaks((prev) =>
                            on
                              ? [...prev, suggestion]
                              : prev.filter((t) => t !== suggestion),
                          )
                        }
                        canRegenerate={Boolean(requestText)}
                        onRegenerateAll={() => {
                          void run();
                        }}
                        onRegenerateDay={
                          onRegenerateDay
                            ? (dayIndex) =>
                                onRegenerateDay(
                                  dayIndex,
                                  requestContext(),
                                  buildTextRequest(),
                                )
                            : undefined
                        }
                        onApply={(nextText, applyMode) => {
                          const issue = validateText?.(nextText) ?? null;
                          setValidationError(issue);
                          if (issue || !onApplyText) return;
                          onApplyText(
                            nextText,
                            { ...result, text: nextText },
                            applyMode,
                          );
                          close();
                        }}
                      />
                    ) : (
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
                    )
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
                    {mode === "text" && onApplyText && responseFormat !== "json" ? (
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
                      <Button
                        onClick={() => {
                          void applyImage();
                        }}
                        disabled={!result.image}
                      >
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

const GUIDE_KEYS = new Set([
  "foodGuide",
  "transportGuide",
  "packingList",
  "etiquetteSafety",
  "bookingChecklist",
  "personalizationQuestions",
  "verificationNotes",
]);

type ApplyMode = "replace" | "fill-empty" | "append";

interface AiReviewPanelProps {
  currentText: string;
  aiText: string;
  applyLabel: string;
  fillEmptyLabel: string;
  appendLabel: string;
  tuningControls?: AiTuningControl[];
  tuning: Record<string, string>;
  onTuningChange: (id: string, value: string) => void;
  instructionsPlaceholder?: string;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  instructionsSuggestions?: string[];
  tweaks: string[];
  onToggleTweak: (suggestion: string, on: boolean) => void;
  canRegenerate: boolean;
  onRegenerateAll: () => void;
  onRegenerateDay?: (dayIndex: number) => Promise<unknown>;
  onApply: (nextText: string, mode: ApplyMode) => void;
}

function AiReviewPanel({
  currentText,
  aiText,
  applyLabel,
  fillEmptyLabel,
  appendLabel,
  tuningControls,
  tuning,
  onTuningChange,
  instructionsPlaceholder,
  instructions,
  onInstructionsChange,
  instructionsSuggestions,
  tweaks,
  onToggleTweak,
  canRegenerate,
  onRegenerateAll,
  onRegenerateDay,
  onApply,
}: AiReviewPanelProps) {
  const current = parseJsonValue(currentText) ?? {};
  const initialAi = parseJsonValue(aiText);
  // Held in state so per-day "Regenerate this day" can swap a single day in place.
  const [aiState, setAiState] = React.useState<unknown>(initialAi);
  const rows = aiState ? flattenJsonRows(aiState, current) : [];

  const [choices, setChoices] = React.useState<Record<string, AiReviewChoice>>(
    () =>
      Object.fromEntries(
        rows.map((row) => [
          row.path,
          isEmptyJsonValue(row.currentValue) ? "use-ai" : "keep-current",
        ]),
      ),
  );
  const [mergeValues, setMergeValues] = React.useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        rows.map((row) => [
          row.path,
          typeof row.currentValue === "string" && typeof row.aiValue === "string"
            ? [row.currentValue, row.aiValue].filter(Boolean).join("\n\n")
            : stringifyJsonValue(row.aiValue),
        ]),
      ),
  );
  const [openDays, setOpenDays] = React.useState<Set<number>>(new Set());
  const [regenDay, setRegenDay] = React.useState<number | null>(null);
  const [showTune, setShowTune] = React.useState(false);

  if (!aiState) {
    return (
      <div className="rounded-2xl border border-terracotta/30 bg-terracotta-soft/60 p-4 text-sm text-terracotta">
        The AI response is not valid JSON, so RouteCrafter cannot safely review
        individual fields.
      </div>
    );
  }

  const groups = groupReviewRows(rows);

  function choiceFor(row: AiReviewRow): AiReviewChoice {
    return (
      choices[row.path] ??
      (isEmptyJsonValue(row.currentValue) ? "use-ai" : "keep-current")
    );
  }

  function setChoice(path: string, choice: AiReviewChoice) {
    setChoices((prev) => ({ ...prev, [path]: choice }));
  }

  function setMergeValue(path: string, value: string) {
    setMergeValues((prev) => ({ ...prev, [path]: value }));
  }

  function setManyChoices(paths: string[], choice: AiReviewChoice) {
    setChoices((prev) => {
      const next = { ...prev };
      for (const path of paths) next[path] = choice;
      return next;
    });
  }

  function applySelected(mode: ApplyMode) {
    const base = cloneJson(
      current && typeof current === "object" && !Array.isArray(current)
        ? current
        : aiState,
    );
    for (const row of rows) {
      if (choiceFor(row) === "keep-current") continue;
      setJsonPath(
        base,
        row.path,
        choiceFor(row) === "merge" ? mergeValues[row.path] : row.aiValue,
      );
    }
    onApply(JSON.stringify(base, null, 2), mode);
  }

  async function regenerateDay(dayIndex: number) {
    if (!onRegenerateDay) return;
    setRegenDay(dayIndex);
    try {
      const newDay = await onRegenerateDay(dayIndex);
      if (newDay && typeof newDay === "object") {
        setAiState((prev: unknown) => {
          const next = cloneJson(prev) as Record<string, unknown>;
          const days = Array.isArray(next.days) ? [...next.days] : [];
          days[dayIndex] = newDay;
          next.days = days;
          return next;
        });
        setManyChoices(
          Object.keys(newDay as Record<string, unknown>).map(
            (key) => `days.${dayIndex}.${key}`,
          ),
          "use-ai",
        );
        setOpenDays((prev) => new Set(prev).add(dayIndex));
      }
    } finally {
      setRegenDay(null);
    }
  }

  const dayCount = groups.days.length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--rc-ai-border)] bg-paper p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">Review the draft</p>
            <p className="mt-1 text-xs text-ink-muted">
              Empty fields default to Use AI; existing fields default to Keep
              mine. Choose per field, per day, or all at once.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setManyChoices(rows.map((row) => row.path), "use-ai")}
              className="rounded-full bg-forest px-3 py-1 text-xs font-semibold text-paper hover:bg-forest-deep"
            >
              Replace all
            </button>
            <button
              type="button"
              onClick={() =>
                setManyChoices(rows.map((row) => row.path), "keep-current")
              }
              className="rounded-full border border-border-strong bg-paper px-3 py-1 text-xs font-semibold text-ink-soft hover:text-ink"
            >
              Keep all mine
            </button>
            <CopyButton value={aiText} />
          </div>
        </div>

        {canRegenerate ? (
          <div className="mb-3 rounded-xl border border-[var(--rc-ai-border)] bg-[var(--rc-ai-gold-soft)]/30">
            <button
              type="button"
              onClick={() => setShowTune((open) => !open)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles className="size-4 text-[var(--rc-ai-brown)]" />
                Tune &amp; regenerate
              </span>
              <ChevronDown
                className={cn(
                  "size-4 text-ink-muted transition-transform",
                  showTune && "rotate-180",
                )}
              />
            </button>
            {showTune ? (
              <div className="space-y-3 border-t border-[var(--rc-ai-border)] p-3">
                {tuningControls?.length ? (
                  <TuningRow
                    controls={tuningControls}
                    values={tuning}
                    onChange={onTuningChange}
                  />
                ) : null}
                {instructionsSuggestions?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {instructionsSuggestions.map((suggestion) => (
                      <CheckboxChip
                        key={suggestion}
                        label={suggestion}
                        selected={tweaks.includes(suggestion)}
                        onToggle={(on) => onToggleTweak(suggestion, on)}
                      />
                    ))}
                  </div>
                ) : null}
                <Textarea
                  autoSize
                  rows={2}
                  placeholder={
                    instructionsPlaceholder ??
                    "e.g. Make the pace more relaxed and add more local food stops"
                  }
                  value={instructions}
                  onChange={(event) => onInstructionsChange(event.target.value)}
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={onRegenerateAll}>
                    <RefreshCw className="size-4" />
                    Regenerate all
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="max-h-[460px] space-y-4 overflow-y-auto pr-1">
          {groups.overview.length ? (
            <ReviewSection title="Overview">
              {groups.overview.map((row) => (
                <FieldRow
                  key={row.path}
                  row={row}
                  choice={choiceFor(row)}
                  onChoice={(choice) => setChoice(row.path, choice)}
                  mergeValue={mergeValues[row.path]}
                  onMergeChange={(value) => setMergeValue(row.path, value)}
                />
              ))}
            </ReviewSection>
          ) : null}

          {groups.guides.length ? (
            <ReviewSection title="Guides">
              {groups.guides.map((row) => (
                <FieldRow
                  key={row.path}
                  row={row}
                  choice={choiceFor(row)}
                  onChoice={(choice) => setChoice(row.path, choice)}
                  mergeValue={mergeValues[row.path]}
                  onMergeChange={(value) => setMergeValue(row.path, value)}
                />
              ))}
            </ReviewSection>
          ) : null}

          {dayCount ? (
            <ReviewSection title={`Days (${dayCount})`}>
              {groups.days.map((group) => (
                <DayReviewCard
                  key={group.index}
                  group={group}
                  open={openDays.has(group.index)}
                  onToggle={() =>
                    setOpenDays((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.index)) next.delete(group.index);
                      else next.add(group.index);
                      return next;
                    })
                  }
                  choiceFor={choiceFor}
                  onSetField={setChoice}
                  onSetDay={(choice) =>
                    setManyChoices(
                      group.rows.map((row) => row.path),
                      choice,
                    )
                  }
                  mergeValues={mergeValues}
                  onMergeChange={setMergeValue}
                  onRegenerate={onRegenerateDay ? regenerateDay : undefined}
                  regenerating={regenDay === group.index}
                />
              ))}
            </ReviewSection>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={() => applySelected("append")}>
          {appendLabel}
        </Button>
        <Button variant="outline" onClick={() => applySelected("fill-empty")}>
          {fillEmptyLabel}
        </Button>
        <Button onClick={() => applySelected("replace")}>{applyLabel}</Button>
      </div>
    </div>
  );
}

interface DayReviewGroup {
  index: number;
  dayNumber: number;
  title: string;
  rows: AiReviewRow[];
  needsAttention: boolean;
}

function groupReviewRows(rows: AiReviewRow[]): {
  overview: AiReviewRow[];
  guides: AiReviewRow[];
  days: DayReviewGroup[];
} {
  const overview: AiReviewRow[] = [];
  const guides: AiReviewRow[] = [];
  const dayRows = new Map<number, AiReviewRow[]>();
  for (const row of rows) {
    const [head, second] = row.path.split(".");
    if (head === "days" && second !== undefined) {
      const index = Number(second);
      const list = dayRows.get(index) ?? [];
      list.push(row);
      dayRows.set(index, list);
    } else if (GUIDE_KEYS.has(head)) {
      guides.push(row);
    } else {
      overview.push(row);
    }
  }
  const days: DayReviewGroup[] = [...dayRows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, list]) => {
      const value = (row: string) =>
        list.find((item) => item.path === `days.${index}.${row}`)?.aiValue;
      const title = stringifyJsonValue(value("title")) || `Day ${index + 1}`;
      const dayNumber = Number(value("day")) || index + 1;
      const filled = ["morning", "afternoon", "evening"]
        .map((key) => value(key))
        .filter((entry) => typeof entry === "string" && entry.trim()).length;
      return { index, dayNumber, title, rows: list, needsAttention: filled === 0 };
    });
  return { overview, guides, days };
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--rc-ai-brown)]">
        {title}
      </p>
      {children}
    </div>
  );
}

function ChoiceButtons({
  choice,
  onChoice,
}: {
  choice: AiReviewChoice | null;
  onChoice: (choice: AiReviewChoice) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {(["keep-current", "use-ai", "merge"] as const).map((nextChoice) => (
        <button
          key={nextChoice}
          type="button"
          onClick={() => onChoice(nextChoice)}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            choice === nextChoice
              ? "bg-forest text-paper"
              : "bg-paper text-ink-muted hover:text-ink",
          )}
        >
          {nextChoice === "keep-current"
            ? "Keep mine"
            : nextChoice === "use-ai"
              ? "Use AI"
              : "Merge"}
        </button>
      ))}
    </div>
  );
}

function FieldRow({
  row,
  label,
  choice,
  onChoice,
  mergeValue,
  onMergeChange,
}: {
  row: AiReviewRow;
  label?: string;
  choice: AiReviewChoice;
  onChoice: (choice: AiReviewChoice) => void;
  mergeValue?: string;
  onMergeChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border-soft bg-paper-2/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink">{label ?? row.path}</p>
        <ChoiceButtons choice={choice} onChoice={onChoice} />
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <MiniValue title="Current" value={row.currentValue} />
        <MiniValue title="AI" value={row.aiValue} />
      </div>
      {choice === "merge" ? (
        <Textarea
          value={mergeValue ?? ""}
          rows={3}
          className="mt-2"
          onChange={(event) => onMergeChange(event.target.value)}
        />
      ) : null}
    </div>
  );
}

function DayReviewCard({
  group,
  open,
  onToggle,
  choiceFor,
  onSetField,
  onSetDay,
  mergeValues,
  onMergeChange,
  onRegenerate,
  regenerating,
}: {
  group: DayReviewGroup;
  open: boolean;
  onToggle: () => void;
  choiceFor: (row: AiReviewRow) => AiReviewChoice;
  onSetField: (path: string, choice: AiReviewChoice) => void;
  onSetDay: (choice: AiReviewChoice) => void;
  mergeValues: Record<string, string>;
  onMergeChange: (path: string, value: string) => void;
  onRegenerate?: (dayIndex: number) => void;
  regenerating: boolean;
}) {
  const dayChoices = new Set(group.rows.map((row) => choiceFor(row)));
  const summary: AiReviewChoice | null =
    dayChoices.size === 1 ? [...dayChoices][0] : null;
  return (
    <div className="rounded-xl border border-border-soft bg-paper-2/35">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-ink-muted transition-transform",
              open && "rotate-180",
            )}
          />
          <span className="text-sm font-semibold text-ink">
            Day {group.dayNumber}
          </span>
          <span className="max-w-[220px] truncate text-xs text-ink-muted">
            {group.title}
          </span>
          {group.needsAttention ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-terracotta/30 bg-terracotta-soft/50 px-2 py-0.5 text-[10px] font-semibold text-terracotta">
              <AlertCircle className="size-3" />
              Needs detail
            </span>
          ) : null}
        </button>
        <div className="flex items-center gap-1.5">
          <ChoiceButtons choice={summary} onChoice={onSetDay} />
          {onRegenerate ? (
            <button
              type="button"
              onClick={() => onRegenerate(group.index)}
              disabled={regenerating}
              className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:text-ink disabled:opacity-60"
            >
              {regenerating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Regenerate
            </button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="space-y-2 border-t border-border-soft p-3">
          {group.rows.map((row) => (
            <FieldRow
              key={row.path}
              row={row}
              label={row.path.split(".").slice(2).join(".")}
              choice={choiceFor(row)}
              onChoice={(choice) => onSetField(row.path, choice)}
              mergeValue={mergeValues[row.path]}
              onMergeChange={(value) => onMergeChange(row.path, value)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TuningRow({
  controls,
  values,
  onChange,
}: {
  controls: AiTuningControl[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {controls.map((control) => (
        <label key={control.id} className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {control.label}
          </span>
          <Select
            value={values[control.id] ?? control.value}
            onChange={(event) => onChange(control.id, event.target.value)}
            className="h-9 text-xs"
          >
            {control.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </label>
      ))}
    </div>
  );
}

function DraftProgressList({
  progress,
  totalDays,
}: {
  progress: DraftProgress[];
  totalDays: number;
}) {
  const daysDone = progress
    .filter((step) => step.kind === "days" && step.status === "done")
    .reduce(
      (total, step) =>
        total +
        (step.dayRange ? step.dayRange[1] - step.dayRange[0] + 1 : 0),
      0,
    );
  const steps =
    progress.length === 0
      ? [
          {
            id: "overview",
            kind: "overview" as const,
            label: "Overview & guides",
            status: "start" as const,
          },
        ]
      : progress;

  return (
    <div className="space-y-2">
      {totalDays > 0 ? (
        <p className="text-xs font-medium text-ink-soft">
          {daysDone} of {totalDays} days drafted
        </p>
      ) : null}
      {steps.map((step) => (
        <div
          key={step.id}
          className="flex items-center gap-3 rounded-xl border border-border-soft bg-paper-2/60 p-3"
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full",
              step.status === "done"
                ? "bg-forest text-paper"
                : "bg-[var(--rc-ai-gold-soft)] text-[var(--rc-ai-brown)]",
            )}
          >
            {step.status === "done" ? (
              <Check className="size-3" />
            ) : (
              <Loader2 className="size-3 animate-spin" />
            )}
          </span>
          <p className="text-sm text-ink-soft">{step.label}</p>
        </div>
      ))}
    </div>
  );
}

function upsertProgress(
  prev: DraftProgress[],
  event: DraftProgress,
): DraftProgress[] {
  const index = prev.findIndex((step) => step.id === event.id);
  if (index === -1) return [...prev, event];
  const next = [...prev];
  next[index] = event;
  return next;
}

function MiniValue({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-lg bg-paper/75 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-ink-soft">
        {stringifyJsonValue(value) || "Empty"}
      </p>
    </div>
  );
}

function parseJsonValue(text: string): unknown | null {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringifyJsonValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function isEmptyJsonValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function flattenJsonRows(ai: unknown, current: unknown, prefix = ""): AiReviewRow[] {
  if (ai && typeof ai === "object" && !Array.isArray(ai)) {
    return Object.entries(ai as Record<string, unknown>).flatMap(([key, value]) =>
      flattenJsonRows(value, getJsonPath(current, key), prefix ? `${prefix}.${key}` : key),
    );
  }
  if (Array.isArray(ai)) {
    if (ai.every((item) => !item || typeof item !== "object")) {
      return [{ path: prefix, currentValue: getJsonPath(current, ""), aiValue: ai }];
    }
    return ai.flatMap((value, index) =>
      flattenJsonRows(value, getJsonPath(current, String(index)), `${prefix}.${index}`),
    );
  }
  return [{ path: prefix, currentValue: current, aiValue: ai }];
}

function getJsonPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split(".").reduce<unknown>((current, part) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) return current[Number(part)];
    if (typeof current === "object") {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, value);
}

function setJsonPath(target: unknown, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = target as Record<string, unknown> | unknown[];
  parts.forEach((part, index) => {
    const last = index === parts.length - 1;
    if (last) {
      if (Array.isArray(current)) current[Number(part)] = value;
      else current[part] = value;
      return;
    }
    const nextPart = parts[index + 1];
    const existing = Array.isArray(current)
      ? current[Number(part)]
      : current[part];
    const next =
      existing && typeof existing === "object"
        ? existing
        : /^\d+$/.test(nextPart)
          ? []
          : {};
    if (Array.isArray(current)) current[Number(part)] = next;
    else current[part] = next;
    current = next as Record<string, unknown> | unknown[];
  });
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-terracotta/30 bg-terracotta-soft/60 p-4 text-sm text-terracotta">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
