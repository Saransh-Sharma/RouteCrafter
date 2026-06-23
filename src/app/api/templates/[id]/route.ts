import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { ensureRequestUser } from "@/lib/db/request-user";
import { deleteTemplateForUser } from "@/lib/db/templates";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const { id } = await context.params;
    await deleteTemplateForUser({ user: requestUser, templateId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
