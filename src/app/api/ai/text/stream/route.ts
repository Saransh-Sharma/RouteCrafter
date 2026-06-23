import { type NextRequest } from "next/server";
import { aiTextRequestSchema } from "@/lib/ai/schemas";
import {
  normalizeProviderError,
  readProviderAttempts,
  streamGenerateText,
} from "@/lib/ai/provider-adapters";
import { getRequestUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import type { User } from "@/lib/schemas/auth";
import {
  AiConfigurationError,
  resolveTextCredential,
} from "@/lib/ai/credentials";
import { createCompletedAiRun, createFailedAiRun } from "@/lib/db/ai-runs";
import { ensureRequestUser } from "@/lib/db/request-user";
import { getProject } from "@/lib/db/projects";
import type { AiResult } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const encoder = new TextEncoder();

function sseText(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sse(event: string, data: unknown): Uint8Array {
  return encoder.encode(sseText(event, data));
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return unauthorizedResponse();

  const json = await request.json().catch(() => null);
  const parsed = aiTextRequestSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(
      sseText("error", { error: "Missing or invalid AI text request." }),
      { status: 400, headers: streamHeaders() },
    );
  }

  let requestSummary:
    | {
        provider: string;
        model: string;
        taskType: string;
        credentialSource?: string;
        label?: string;
        source?: string;
        projectId?: string;
      }
    | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(sse("phase", { phase: "preparing" }));
        const resolved = {
          ...parsed.data,
          ...resolveTextCredential(parsed.data),
        };
        requestSummary = {
          provider: resolved.provider,
          model: resolved.model,
          taskType: resolved.taskType,
          credentialSource: resolved.credentialSource,
          label: parsed.data.label,
          source: parsed.data.source,
          projectId: parsed.data.projectId,
        };
        if (process.env.DATABASE_URL && parsed.data.projectId) {
          await ensureRequestUser(user);
          const project = await getProject(parsed.data.projectId);
          if (!project) {
            controller.enqueue(sse("error", { error: "Project not found." }));
            controller.close();
            return;
          }
        }

        controller.enqueue(sse("phase", { phase: "calling-provider" }));
        let finalResult: AiResult | null = null;
        for await (const event of streamGenerateText(resolved, request.signal)) {
          if (event.type === "delta") {
            controller.enqueue(sse("delta", { text: event.text }));
          } else {
            finalResult = event.result;
          }
        }
        if (!finalResult) throw new Error("The provider returned no result.");
        controller.enqueue(sse("phase", { phase: "validating" }));
        const aiRunId = await recordCompletedAiRun(
          user,
          finalResult,
          parsed.data.taskType,
          parsed.data.label,
          parsed.data.source,
          parsed.data.projectId,
        );
        controller.enqueue(sse("result", { ...finalResult, aiRunId }));
        controller.close();
      } catch (error) {
        if (isAbortError(error) || request.signal.aborted) {
          try {
            controller.enqueue(sse("cancelled", { cancelled: true }));
          } catch {
            // The client may already have closed the connection.
          }
          controller.close();
          return;
        }
        await recordFailedAiRun(user, requestSummary, error);
        controller.enqueue(
          sse("error", {
            error: normalizeProviderError(error),
            providerAttempts: readProviderAttempts(error),
          }),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: streamHeaders() });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function streamHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
  };
}

async function recordCompletedAiRun(
  user: User,
  result: AiResult,
  taskType: string,
  label?: string,
  source?: string,
  projectId?: string,
): Promise<string | undefined> {
  if (!process.env.DATABASE_URL) return undefined;
  try {
    const requestUser = await ensureRequestUser(user);
    return await createCompletedAiRun({
      userId: requestUser.id,
      result,
      taskType: taskType as never,
      label: label ?? taskType,
      source,
      projectId,
    });
  } catch {
    return undefined;
  }
}

async function recordFailedAiRun(
  user: User | null,
  summary:
    | {
        provider: string;
        model: string;
        taskType: string;
        credentialSource?: string;
        label?: string;
        source?: string;
        projectId?: string;
      }
    | null,
  error: unknown,
): Promise<void> {
  if (!process.env.DATABASE_URL || !user || !summary) return;
  try {
    const requestUser = await ensureRequestUser(user);
    await createFailedAiRun({
      userId: requestUser.id,
      provider: summary.provider,
      model: summary.model,
      taskType: summary.taskType,
      label: summary.label ?? summary.taskType,
      source: summary.source,
      projectId: summary.projectId,
      credentialSource: summary.credentialSource ?? "server",
      error:
        error instanceof AiConfigurationError
          ? error.message
          : normalizeProviderError(error),
    });
  } catch {
    // Do not mask the provider result with ledger write failures.
  }
}
