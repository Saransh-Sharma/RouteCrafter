import { NextResponse, type NextRequest } from "next/server";
import { aiTextRequestSchema } from "@/lib/ai/schemas";
import { generateText, normalizeProviderError, readProviderAttempts } from "@/lib/ai/provider-adapters";
import { aiResponseHeaders } from "@/lib/ai/http";
import { getRequestUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import type { User } from "@/lib/schemas/auth";
import {
  AiConfigurationError,
  resolveTextCredential,
} from "@/lib/ai/credentials";
import { createCompletedAiRun, createFailedAiRun } from "@/lib/db/ai-runs";
import { ensureRequestUser } from "@/lib/db/request-user";
import { getProjectForUser } from "@/lib/db/projects";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let ledgerUser: User | null = null;
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
  try {
    const user = await getRequestUser(request);
    if (!user) return unauthorizedResponse();
    ledgerUser = user;

    const json = await request.json();
    const parsed = aiTextRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid AI text request." },
        { status: 400 },
      );
    }
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
      const requestUser = await ensureRequestUser(user);
      const project = await getProjectForUser({
        userId: requestUser.id,
        projectId: parsed.data.projectId,
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
    }
    const result = await generateText(resolved, request.signal);
    const aiRunId = await recordCompletedAiRun(
      user,
      result,
      parsed.data.taskType,
      parsed.data.label,
      parsed.data.source,
      parsed.data.projectId,
    );
    return NextResponse.json({ ...result, aiRunId }, {
      headers: aiResponseHeaders(result.providerAttempts),
    });
  } catch (error) {
    await recordFailedAiRun(ledgerUser, requestSummary, error);
    return NextResponse.json(
      { error: normalizeProviderError(error) },
      {
        status: error instanceof AiConfigurationError ? error.status : 500,
        headers: aiResponseHeaders(readProviderAttempts(error)),
      },
    );
  }
}

async function recordCompletedAiRun(
  user: User,
  result: Awaited<ReturnType<typeof generateText>>,
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
      error: normalizeProviderError(error),
    });
  } catch {
    // Do not mask the provider result with ledger write failures.
  }
}
