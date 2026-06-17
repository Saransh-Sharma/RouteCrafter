import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import {
  getProject,
  softDeleteProjectForUser,
  upsertProjectForUser,
} from "@/lib/db/projects";
import { ensureRequestUser } from "@/lib/db/request-user";
import { projectMutationSchema } from "@/lib/persistence/types";

export const dynamic = "force-dynamic";

const projectDeleteSchema = z.object({
  expectedRevision: z.number().int().positive(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    await ensureRequestUser(user);
    const { id } = await context.params;
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    // The shared workspace relies on fresh reads (refreshProject + 409 refetch),
    // so never serve a cached project body.
    return NextResponse.json(
      { project },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const { id } = await context.params;
    const parsed = projectMutationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid project payload." },
        { status: 400 },
      );
    }
    const project = await upsertProjectForUser({
      user: requestUser,
      project: { ...(parsed.data.project as object), id },
      expectedRevision: parsed.data.expectedRevision,
      activityDetail: parsed.data.activityDetail,
      restore: parsed.data.restore,
    });
    return NextResponse.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const { id } = await context.params;
    const parsed = projectDeleteSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid project revision." },
        { status: 400 },
      );
    }
    await softDeleteProjectForUser({
      user: requestUser,
      projectId: id,
      expectedRevision: parsed.data.expectedRevision,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
