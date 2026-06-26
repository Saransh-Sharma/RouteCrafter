import { NextResponse } from "next/server";
import { z } from "zod";
import {
  jsonBadRequest,
  jsonNoStore,
  parseBody,
  withUser,
} from "@/lib/api/route-handler";
import {
  getProject,
  softDeleteProjectForUser,
  upsertProjectForUser,
} from "@/lib/db/projects";
import { projectMutationSchema } from "@/lib/persistence/types";

export const dynamic = "force-dynamic";

const projectDeleteSchema = z.object({
  expectedRevision: z.number().int().positive(),
});

export const GET = withUser(async (
  _auth,
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) {
    return jsonNoStore({ error: "Project not found." }, { status: 404 });
  }
  return jsonNoStore({ project });
});

export const PUT = withUser(async (
  { requestUser },
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await context.params;
  const parsed = await parseBody(
    request,
    projectMutationSchema,
    "Missing or invalid project payload.",
  );
  if (!parsed.ok) return parsed.response;
  const project = await upsertProjectForUser({
    user: requestUser,
    project: { ...(parsed.data.project as object), id },
    expectedRevision: parsed.data.expectedRevision,
    activityDetail: parsed.data.activityDetail,
    restore: parsed.data.restore,
  });
  return NextResponse.json({ project });
});

export const DELETE = withUser(async (
  { requestUser },
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await context.params;
  const parsed = projectDeleteSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return jsonBadRequest("Missing or invalid project revision.");
  }
  await softDeleteProjectForUser({
    user: requestUser,
    projectId: id,
    expectedRevision: parsed.data.expectedRevision,
  });
  return NextResponse.json({ ok: true });
});
