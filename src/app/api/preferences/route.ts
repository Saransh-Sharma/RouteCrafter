import { NextResponse } from "next/server";
import { parseBody, withUser } from "@/lib/api/route-handler";
import { getPreferences, upsertPreferences } from "@/lib/db/preferences";
import { preferencePayloadSchema } from "@/lib/persistence/types";

export const dynamic = "force-dynamic";

export const GET = withUser(async ({ requestUser }) =>
  NextResponse.json({ preferences: await getPreferences(requestUser.id) }),
);

export const PUT = withUser(async ({ requestUser }, request: Request) => {
  const parsed = await parseBody(
    request,
    preferencePayloadSchema,
    "Missing or invalid preferences payload.",
  );
  if (!parsed.ok) return parsed.response;
  const preferences = await upsertPreferences({
    userId: requestUser.id,
    ...parsed.data,
  });
  return NextResponse.json({ preferences });
});
