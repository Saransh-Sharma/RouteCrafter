import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { createActivity, listProjectActivity } from "@/lib/db/activity";
import { getProjectForUser } from "@/lib/db/projects";
import { ensureRequestUser } from "@/lib/db/request-user";
import { activityCreateSchema } from "@/lib/persistence/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const { id } = await context.params;
    const project = await getProjectForUser({ userId: requestUser.id, projectId: id });
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    const url = new URL(request.url);
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
    );
    const entries = await listProjectActivity({
      userId: requestUser.id,
      projectId: id,
      limit,
      cursor: url.searchParams.get("cursor"),
    });
    return NextResponse.json({ entries });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const { id } = await context.params;
    const project = await getProjectForUser({ userId: requestUser.id, projectId: id });
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    const parsed = activityCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid activity payload." },
        { status: 400 },
      );
    }
    await createActivity({
      projectId: id,
      ownerUserId: requestUser.id,
      actor: requestUser,
      action: parsed.data.action,
      detail: parsed.data.detail,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      metadata: parsed.data.metadata,
      clientEventId: parsed.data.clientEventId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
