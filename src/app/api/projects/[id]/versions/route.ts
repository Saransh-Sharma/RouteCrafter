import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { getProjectForUser } from "@/lib/db/projects";
import { ensureRequestUser } from "@/lib/db/request-user";
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

export async function GET(
  _request: Request,
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
    return NextResponse.json({
      versions: await listProjectVersions({ userId: requestUser.id, projectId: id }),
    });
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
    const parsed = createVersionSchema.safeParse(await request.json().catch(() => ({})));
    await createProjectVersion({
      project: project.project,
      userId: requestUser.id,
      revision: project.revision,
      reason: (parsed.success ? parsed.data.reason : "manual-backup") as ProjectVersionReason,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
