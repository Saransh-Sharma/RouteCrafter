import type {
  AiCostEstimate,
  AiProviderId,
  AiTaskType,
} from "./types";

interface TextPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const TEXT_PRICING: Partial<Record<AiProviderId, Record<string, TextPricing>>> = {
  openai: {
    "gpt-5.4": { inputPerMillion: 2.5, outputPerMillion: 15 },
    "gpt-5.2": { inputPerMillion: 1.75, outputPerMillion: 14 },
    "gpt-5.1": { inputPerMillion: 1.25, outputPerMillion: 10 },
    "gpt-4.1": { inputPerMillion: 2, outputPerMillion: 8 },
  },
  anthropic: {
    "claude-sonnet-4-6": { inputPerMillion: 3, outputPerMillion: 15 },
    "claude-opus-4-8": { inputPerMillion: 5, outputPerMillion: 25 },
    "claude-haiku-4-5": { inputPerMillion: 1, outputPerMillion: 5 },
  },
  gemini: {
    "gemini-3.5-flash": { inputPerMillion: 1.5, outputPerMillion: 9 },
    "gemini-3.1-pro": { inputPerMillion: 2, outputPerMillion: 12 },
    "gemini-3-flash": { inputPerMillion: 0.5, outputPerMillion: 3 },
  },
};

const TASK_OUTPUT_FLOOR: Record<AiTaskType, number> = {
  brief: 600,
  prompt: 500,
  itinerary: 1600,
  matrix: 1200,
  listing: 800,
  imagePrompt: 400,
  imageGeneration: 0,
  guide: 1200,
  rewrite: 500,
  dayDetails: 1200,
};

const GPT_IMAGE_2_OUTPUT: Record<string, Record<string, number>> = {
  "1024x1024": { low: 0.006, medium: 0.053, high: 0.211 },
  "1024x1536": { low: 0.005, medium: 0.041, high: 0.165 },
  "1536x1024": { low: 0.005, medium: 0.041, high: 0.165 },
};

const GEMINI_IMAGE_OUTPUT: Record<string, Record<string, number>> = {
  "gemini-3.1-flash-image": {
    "1024x1024": 0.067,
    "2048x2048": 0.101,
    "4096x4096": 0.151,
  },
  "gemini-3-pro-image": {
    "1024x1024": 0.134,
    "2048x2048": 0.134,
    "4096x4096": 0.24,
  },
  "gemini-2.5-flash-image": {
    "1024x1024": 0.039,
  },
};

type EstimateInput =
  | {
      mode: "text";
      provider: AiProviderId;
      model: string;
      prompt: string;
      taskType: AiTaskType;
      maxOutputTokens: number;
    }
  | {
      mode: "image";
      provider: AiProviderId;
      model: string;
      prompt: string;
      taskType: AiTaskType;
      size?: string;
      quality?: string;
    };

function promptTokenRange(prompt: string): [number, number] {
  return [
    Math.max(1, Math.ceil(prompt.length / 4)),
    Math.max(1, Math.ceil(prompt.length / 3)),
  ];
}

function tokenCost(tokens: number, perMillion: number): number {
  return (tokens * perMillion) / 1_000_000;
}

export function estimateAiRunCost(
  input: EstimateInput,
): AiCostEstimate | null {
  const [inputTokensLow, inputTokensHigh] = promptTokenRange(input.prompt);

  if (input.mode === "text") {
    const pricing = TEXT_PRICING[input.provider]?.[input.model];
    if (!pricing) return null;
    const outputTokensHigh = input.maxOutputTokens;
    const outputTokensLow = Math.min(
      TASK_OUTPUT_FLOOR[input.taskType],
      outputTokensHigh,
    );
    return {
      currency: "USD",
      lowUsd:
        tokenCost(inputTokensLow, pricing.inputPerMillion) +
        tokenCost(outputTokensLow, pricing.outputPerMillion),
      highUsd:
        tokenCost(inputTokensHigh, pricing.inputPerMillion) +
        tokenCost(outputTokensHigh, pricing.outputPerMillion),
      basis: `${input.model} prompt estimate and ${outputTokensLow}-${outputTokensHigh} output tokens`,
      inputTokensLow,
      inputTokensHigh,
      outputTokensLow,
      outputTokensHigh,
    };
  }

  const size = input.size || "1024x1024";
  const quality = input.quality || "medium";
  if (input.provider === "openai" && input.model === "gpt-image-2") {
    const outputCost = GPT_IMAGE_2_OUTPUT[size]?.[quality];
    if (outputCost === undefined) return null;
    return {
      currency: "USD",
      lowUsd: outputCost + tokenCost(inputTokensLow, 5),
      highUsd: outputCost + tokenCost(inputTokensHigh, 5),
      basis: `one ${quality} ${size} image plus prompt input`,
      inputTokensLow,
      inputTokensHigh,
    };
  }

  if (input.provider === "gemini") {
    const outputCost = GEMINI_IMAGE_OUTPUT[input.model]?.[size];
    if (outputCost === undefined) return null;
    const inputRate = input.model === "gemini-3-pro-image" ? 2 : 0.5;
    return {
      currency: "USD",
      lowUsd: outputCost + tokenCost(inputTokensLow, inputRate),
      highUsd: outputCost + tokenCost(inputTokensHigh, inputRate),
      basis: `one ${size} image plus prompt input`,
      inputTokensLow,
      inputTokensHigh,
    };
  }

  return null;
}

export function formatUsd(value: number): string {
  const digits = value < 0.001 ? 4 : 3;
  return `$${value.toFixed(digits)}`;
}

export function formatCostEstimate(
  estimate: AiCostEstimate | null,
): string {
  if (!estimate) return "Estimate unavailable";
  const low = formatUsd(estimate.lowUsd);
  const high = formatUsd(estimate.highUsd);
  return low === high ? low : `${low}-${high}`;
}
