import { NextResponse } from "next/server";
import { parseBody, withUser } from "@/lib/api/route-handler";
import { createActivity, listProjectActivity } from "@/lib/db/activity";
import { getProject } from "@/lib/db/projects";
import { activityCreateSchema } from "@/lib/persistence/types";

export const dynamic = "force-dynamic";

export const GET = withUser(async (
  _auth,
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  const url = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
  );
  const entries = await listProjectActivity({
    projectId: id,
    limit,
    cursor: url.searchParams.get("cursor"),
  });
  return NextResponse.json({ entries });
});

export const POST = withUser(async (
  { requestUser },
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  const parsed = await parseBody(
    request,
    activityCreateSchema,
    "Missing or invalid activity payload.",
  );
  if (!parsed.ok) return parsed.response;
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
});
