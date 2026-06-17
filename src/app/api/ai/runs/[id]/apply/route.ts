import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { markAiRunApplied } from "@/lib/db/ai-runs";
import { getAssetForUser } from "@/lib/db/assets";
import { getProjectForUser } from "@/lib/db/projects";
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
    if (parsed.data.projectId) {
      const project = await getProjectForUser({
        userId: requestUser.id,
        projectId: parsed.data.projectId,
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
    }
    if (parsed.data.assetId) {
      const asset = await getAssetForUser({
        userId: requestUser.id,
        assetId: parsed.data.assetId,
      });
      if (!asset) {
        return NextResponse.json({ error: "Asset not found." }, { status: 404 });
      }
      if (parsed.data.projectId && asset.projectId !== parsed.data.projectId) {
        return NextResponse.json(
          { error: "Asset does not belong to the target project." },
          { status: 400 },
        );
      }
    }
    const updated = await markAiRunApplied({
      userId: requestUser.id,
      aiRunId: id,
      ...parsed.data,
    });
    if (!updated) {
      return NextResponse.json({ error: "AI run not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
