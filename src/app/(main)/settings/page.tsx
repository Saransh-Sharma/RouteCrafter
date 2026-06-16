"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AI_PROVIDERS, AI_PROVIDER_IDS } from "@/lib/ai/providers";
import type { AiProviderId } from "@/lib/ai/types";
import {
  maskApiKey,
  useAiSettingsStore,
} from "@/lib/store/ai-settings-store";
import { requestAiText } from "@/lib/ai/client";
import { useMounted } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select } from "@/components/ui/field";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AiCostBadge } from "@/components/ai/AiCostButton";
import { useAiConfig } from "@/components/ai/AiConfigProvider";

export default function SettingsPage() {
  const mounted = useMounted();
  const { config, loading: configLoading } = useAiConfig();
  const providers = useAiSettingsStore((state) => state.providers);
  const text = useAiSettingsStore((state) => state.text);
  const image = useAiSettingsStore((state) => state.image);
  const setProviderKey = useAiSettingsStore((state) => state.setProviderKey);
  const removeProviderKey = useAiSettingsStore(
    (state) => state.removeProviderKey,
  );
  const setProviderCustomModel = useAiSettingsStore(
    (state) => state.setProviderCustomModel,
  );
  const setProviderTestResult = useAiSettingsStore(
    (state) => state.setProviderTestResult,
  );
  const setTextDefaults = useAiSettingsStore((state) => state.setTextDefaults);
  const setImageDefaults = useAiSettingsStore((state) => state.setImageDefaults);

  const [draftKeys, setDraftKeys] = React.useState<Record<AiProviderId, string>>(
    { openai: "", anthropic: "", gemini: "" },
  );
  const [testing, setTesting] = React.useState<AiProviderId | null>(null);

  if (!mounted) {
    return (
      <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-paper-2/40" />
    );
  }

  async function testProvider(provider: AiProviderId) {
    const apiKey = providers[provider].apiKey;
    const canUseServer =
      provider === "openai" && Boolean(config?.serverOpenAiAvailable);
    if (!apiKey && !canUseServer) {
      setProviderTestResult(provider, {
        status: "error",
        message: "Add an API key before testing.",
      });
      return;
    }
    setTesting(provider);
    try {
      const info = AI_PROVIDERS[provider];
      const model =
        providers[provider].customTextModel || info.defaultTextModel;
      await requestAiText({
        provider,
        apiKey: apiKey || undefined,
        model,
        taskType: "prompt",
        prompt:
          "Reply with the exact text: RouteCrafter AI settings connection OK",
        maxOutputTokens: 32,
        temperature: 0,
      });
      setProviderTestResult(provider, {
        status: "ok",
        message: "Connection worked. This may appear in provider usage.",
      });
    } catch (error) {
      setProviderTestResult(provider, {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Connection test failed.",
      });
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Settings"
        title="AI Studio Settings"
        subtitle="RouteCrafter uses server OpenAI by default. Add a personal provider key only when you want to pay with and use your own account."
      />

      <div className="rounded-[var(--radius-card)] border border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)] p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--rc-ai-gold-soft)] text-[var(--rc-ai-brown)]">
            <ShieldAlert className="size-5" />
          </span>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-ink">
                {config?.serverOpenAiAvailable
                  ? "RouteCrafter OpenAI is ready"
                  : configLoading
                    ? "Checking RouteCrafter OpenAI"
                    : "RouteCrafter OpenAI is not configured"}
              </p>
              <AiCostBadge />
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-ink-soft">
              {config?.serverOpenAiAvailable
                ? `Text runs use ${config.serverTextModel} and image runs use ${config.serverImageModel} on RouteCrafter's server account unless the selected provider has a personal key.`
                : "Add a personal provider key to run AI until OPEN_AI_KEY is configured on the server."}{" "}
              Personal keys are saved only in this browser&apos;s local storage
              and are not synced or encrypted.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-5">
          {AI_PROVIDER_IDS.map((provider) => {
            const info = AI_PROVIDERS[provider];
            const saved = providers[provider];
            const keyDraft = draftKeys[provider];
            return (
              <Card key={provider} className="overflow-hidden">
                <CardHeader className="border-b border-border-soft bg-paper-2/30">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <KeyRound className="size-4 text-terracotta" />
                        {info.label}
                      </CardTitle>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {provider === "openai" &&
                        config?.serverOpenAiAvailable ? (
                          <Badge tone={saved.apiKey ? "gold" : "sage"}>
                            {saved.apiKey
                              ? "Personal key override active"
                              : "RouteCrafter server default"}
                          </Badge>
                        ) : null}
                        <CapabilityBadge enabled={info.capabilities.text}>
                          Text
                        </CapabilityBadge>
                        <CapabilityBadge enabled={info.capabilities.image}>
                          Image
                        </CapabilityBadge>
                        <CapabilityBadge
                          enabled={info.capabilities.structuredJson}
                        >
                          Structured JSON
                        </CapabilityBadge>
                      </div>
                    </div>
                    <a
                      href={info.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"
                    >
                      Docs
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <FormField
                    label="API key"
                    hint={
                      saved.apiKey
                        ? `Personal override saved as ${maskApiKey(saved.apiKey)}`
                        : provider === "openai" &&
                            config?.serverOpenAiAvailable
                          ? "Optional. Leave blank to use RouteCrafter OpenAI."
                          : "Saved only in this browser."
                    }
                  >
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        type="password"
                        value={keyDraft}
                        placeholder={info.keyPlaceholder}
                        onChange={(event) =>
                          setDraftKeys((current) => ({
                            ...current,
                            [provider]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setProviderKey(provider, keyDraft);
                          setDraftKeys((current) => ({
                            ...current,
                            [provider]: "",
                          }));
                        }}
                        disabled={!keyDraft.trim()}
                      >
                        Save key
                      </Button>
                    </div>
                  </FormField>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Custom text model">
                      <Input
                        value={saved.customTextModel}
                        placeholder={info.defaultTextModel}
                        onChange={(event) =>
                          setProviderCustomModel(
                            provider,
                            "text",
                            event.target.value,
                          )
                        }
                      />
                    </FormField>
                    <FormField label="Custom image model">
                      <Input
                        value={saved.customImageModel}
                        placeholder={info.defaultImageModel || "Not supported"}
                        disabled={!info.capabilities.image}
                        onChange={(event) =>
                          setProviderCustomModel(
                            provider,
                            "image",
                            event.target.value,
                          )
                        }
                      />
                    </FormField>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-h-5 text-xs text-ink-muted">
                      {saved.lastTestStatus ? (
                        <span className="inline-flex items-start gap-1.5">
                          {saved.lastTestStatus === "ok" ? (
                            <CheckCircle2 className="mt-0.5 size-3.5 text-forest" />
                          ) : (
                            <AlertTriangle className="mt-0.5 size-3.5 text-terracotta" />
                          )}
                          {saved.lastTestMessage}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testProvider(provider)}
                        disabled={
                          testing === provider ||
                          (!saved.apiKey &&
                            !(
                              provider === "openai" &&
                              config?.serverOpenAiAvailable
                            ))
                        }
                      >
                        <Sparkles className="size-4" />
                        {testing === provider ? "Testing..." : "Test connection"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProviderKey(provider)}
                        disabled={!saved.apiKey}
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Card className="border-[var(--rc-ai-border)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-4 text-[var(--rc-ai-brown)]" />
                Text defaults
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Default text provider">
                <Select
                  value={text.provider}
                  onChange={(event) =>
                    setTextDefaults({
                      provider: event.target.value as AiProviderId,
                      model:
                        providers[event.target.value as AiProviderId]
                          .customTextModel ||
                        AI_PROVIDERS[event.target.value as AiProviderId]
                          .defaultTextModel,
                    })
                  }
                >
                  {AI_PROVIDER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {AI_PROVIDERS[id].label}
                    </option>
                  ))}
                </Select>
              </FormField>
              {!providers[text.provider].apiKey &&
              config?.serverOpenAiAvailable ? (
                <p className="text-xs leading-relaxed text-ink-muted">
                  Without a personal key, runs use OpenAI{" "}
                  {config.serverTextModel} on RouteCrafter&apos;s account
                  regardless of the provider selected here.
                </p>
              ) : null}
              <FormField label="Text model">
                <ModelSelect
                  value={text.model}
                  provider={text.provider}
                  kind="text"
                  custom={providers[text.provider].customTextModel}
                  onChange={(model) => setTextDefaults({ model })}
                />
              </FormField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <NumberField
                  label="Temperature"
                  value={text.temperature}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(temperature) => setTextDefaults({ temperature })}
                />
                <NumberField
                  label="Top-p"
                  value={text.topP}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(topP) => setTextDefaults({ topP })}
                />
                <NumberField
                  label="Max tokens"
                  value={text.maxOutputTokens}
                  min={256}
                  max={32000}
                  step={256}
                  onChange={(maxOutputTokens) =>
                    setTextDefaults({ maxOutputTokens })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[var(--rc-ai-border)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-4 text-[var(--rc-ai-brown)]" />
                Image defaults
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Default image provider">
                <Select
                  value={image.provider}
                  onChange={(event) => {
                    const provider = event.target.value as AiProviderId;
                    setImageDefaults({
                      provider,
                      model:
                        providers[provider].customImageModel ||
                        AI_PROVIDERS[provider].defaultImageModel,
                    });
                  }}
                >
                  {AI_PROVIDER_IDS.map((id) => (
                    <option
                      key={id}
                      value={id}
                      disabled={!AI_PROVIDERS[id].capabilities.image}
                    >
                      {AI_PROVIDERS[id].label}
                      {!AI_PROVIDERS[id].capabilities.image ? " (text only)" : ""}
                    </option>
                  ))}
                </Select>
              </FormField>
              {!providers[image.provider].apiKey &&
              config?.serverOpenAiAvailable ? (
                <p className="text-xs leading-relaxed text-ink-muted">
                  Without a personal key, image runs use OpenAI{" "}
                  {config.serverImageModel} on RouteCrafter&apos;s account.
                </p>
              ) : null}
              <FormField label="Image model">
                <ModelSelect
                  value={image.model}
                  provider={image.provider}
                  kind="image"
                  custom={providers[image.provider].customImageModel}
                  onChange={(model) => setImageDefaults({ model })}
                />
              </FormField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField label="Size">
                  <Input
                    value={image.size}
                    onChange={(event) =>
                      setImageDefaults({ size: event.target.value })
                    }
                  />
                </FormField>
                <FormField label="Quality">
                  <Input
                    value={image.quality}
                    onChange={(event) =>
                      setImageDefaults({ quality: event.target.value })
                    }
                  />
                </FormField>
                <FormField label="Aspect ratio">
                  <Input
                    value={image.aspectRatio}
                    onChange={(event) =>
                      setImageDefaults({ aspectRatio: event.target.value })
                    }
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold text-ink">
                Locked safety defaults
              </p>
              <Badge tone="gold">Preview before apply: on</Badge>
              <Badge tone="gold">Billable confirmation: on</Badge>
              <p className="text-xs leading-relaxed text-ink-muted">
                These are locked in v1 so AI never overwrites your edited travel
                product without review.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CapabilityBadge({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <Badge tone={enabled ? "sage" : "neutral"}>
      {enabled ? children : `${children} unavailable`}
    </Badge>
  );
}

function ModelSelect({
  provider,
  kind,
  value,
  custom,
  onChange,
}: {
  provider: AiProviderId;
  kind: "text" | "image";
  value: string;
  custom: string;
  onChange: (model: string) => void;
}) {
  const info = AI_PROVIDERS[provider];
  const models = kind === "text" ? info.textModels : info.imageModels;
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      {custom ? <option value={custom}>{custom} (custom)</option> : null}
      {models.map((model) => (
        <option key={model} value={model}>
          {model}
        </option>
      ))}
    </Select>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <FormField label={label}>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </FormField>
  );
}
