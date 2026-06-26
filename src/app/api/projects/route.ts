import { NextResponse } from "next/server";
import { jsonNoStore, parseBody, withUser } from "@/lib/api/route-handler";
import {
  listProjects,
  upsertProjectForUser,
} from "@/lib/db/projects";
import { projectMutationSchema } from "@/lib/persistence/types";

export const dynamic = "force-dynamic";

export const GET = withUser(async () =>
  jsonNoStore({ projects: await listProjects() }),
);

export const POST = withUser(async ({ requestUser }, request: Request) => {
  const parsed = await parseBody(
    request,
    projectMutationSchema,
    "Missing or invalid project payload.",
  );
  if (!parsed.ok) return parsed.response;
  const project = await upsertProjectForUser({
    user: requestUser,
    project: parsed.data.project,
    expectedRevision: parsed.data.expectedRevision,
    activityDetail: parsed.data.activityDetail,
  });
  return NextResponse.json({ project });
});
