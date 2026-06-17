import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { ensureRequestUser } from "@/lib/db/request-user";
import { listProjectRevisions } from "@/lib/db/projects";

export const dynamic = "force-dynamic";

/**
 * Lightweight polling endpoint: returns only `{ id, revision, updatedAt }` for
 * every live project so the client can detect which projects changed and fetch
 * just those bodies, instead of transferring the entire workspace each tick.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    await ensureRequestUser(user);
    return NextResponse.json(
      { revisions: await listProjectRevisions() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
