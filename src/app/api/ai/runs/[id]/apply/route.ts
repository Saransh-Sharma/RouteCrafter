import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { markAiRunApplied } from "@/lib/db/ai-runs";
import { ensureRequestUser } from "@/lib/db/request-user";

export const dynamic = "force-dynamic";

const applySchema = z.object({
  projectId: z.string().optional(),
  projectRevision: z.number().int().positive().optional(),
  assetId: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const { id } = await context.params;
    const parsed = applySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid AI run apply payload." },
        { status: 400 },
      );
    }
    await markAiRunApplied({
      userId: requestUser.id,
      aiRunId: id,
      ...parsed.data,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
