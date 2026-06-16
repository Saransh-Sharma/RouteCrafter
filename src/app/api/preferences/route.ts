import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { getPreferences, upsertPreferences } from "@/lib/db/preferences";
import { ensureRequestUser } from "@/lib/db/request-user";
import { preferencePayloadSchema } from "@/lib/persistence/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    return NextResponse.json({ preferences: await getPreferences(requestUser.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const parsed = preferencePayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid preferences payload." },
        { status: 400 },
      );
    }
    const preferences = await upsertPreferences({
      userId: requestUser.id,
      ...parsed.data,
    });
    return NextResponse.json({ preferences });
  } catch (error) {
    return errorResponse(error);
  }
}
