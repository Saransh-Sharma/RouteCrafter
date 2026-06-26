import { jsonNoStore, withUser } from "@/lib/api/route-handler";
import { listProjectRevisions } from "@/lib/db/projects";

export const dynamic = "force-dynamic";

/**
 * Lightweight polling endpoint: returns only `{ id, revision, updatedAt }` for
 * every live project so the client can detect which projects changed and fetch
 * just those bodies, instead of transferring the entire workspace each tick.
 */
export const GET = withUser(async () =>
  jsonNoStore({ revisions: await listProjectRevisions() }),
);
