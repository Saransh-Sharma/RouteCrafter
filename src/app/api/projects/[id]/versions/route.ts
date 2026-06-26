import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api/route-handler";
import { getProject } from "@/lib/db/projects";
import {
  createProjectVersion,
  listProjectVersions,
  type ProjectVersionReason,
} from "@/lib/db/project-versions";

export const dynamic = "force-dynamic";

const createVersionSchema = z.object({
  reason: z
    .enum([
      "imported",
      "before-cloud-migration",
      "manual-backup",
      "published",
      "major-ai-apply",
      "deleted",
    ])
    .default("manual-backup"),
});

export const GET = withUser(async (
  _auth,
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json({
    versions: await listProjectVersions({ projectId: id }),
  });
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
  const parsed = createVersionSchema.safeParse(await request.json().catch(() => ({})));
  await createProjectVersion({
    project: project.project,
    userId: requestUser.id,
    revision: project.revision,
    reason: (parsed.success
      ? parsed.data.reason
      : "manual-backup") as ProjectVersionReason,
  });
  return NextResponse.json({ ok: true });
});
