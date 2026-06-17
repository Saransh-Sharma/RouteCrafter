import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { bulkSyncProjectsForUser } from "@/lib/db/projects";
import { ensureRequestUser } from "@/lib/db/request-user";

export const dynamic = "force-dynamic";

const syncSchema = z.object({
  projects: z.array(z.unknown()).default([]),
});

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const parsed = syncSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid projects payload." },
        { status: 400 },
      );
    }
    const projects = await bulkSyncProjectsForUser({
      user: requestUser,
      incoming: parsed.data.projects,
    });
    return NextResponse.json({ projects });
  } catch (error) {
    return errorResponse(error);
  }
}
