import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api/route-handler";
import { bulkSyncProjectsForUser } from "@/lib/db/projects";

export const dynamic = "force-dynamic";

const syncSchema = z.object({
  projects: z.array(z.unknown()).default([]),
});

export const POST = withUser(async ({ requestUser }, request: Request) => {
  const parsed = await parseBody(
    request,
    syncSchema,
    "Missing or invalid projects payload.",
  );
  if (!parsed.ok) return parsed.response;
  const projects = await bulkSyncProjectsForUser({
    user: requestUser,
    incoming: parsed.data.projects,
  });
  return NextResponse.json({ projects });
});
