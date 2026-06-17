import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { ensureRequestUser } from "@/lib/db/request-user";
import {
  listProjectsForUser,
  upsertProjectForUser,
} from "@/lib/db/projects";
import { projectMutationSchema } from "@/lib/persistence/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    return NextResponse.json(
      { projects: await listProjectsForUser(requestUser.id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const body = await request.json();
    const parsed = projectMutationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid project payload." },
        { status: 400 },
      );
    }
    const project = await upsertProjectForUser({
      user: requestUser,
      project: parsed.data.project,
      expectedRevision: parsed.data.expectedRevision,
      activityDetail: parsed.data.activityDetail,
    });
    return NextResponse.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}
