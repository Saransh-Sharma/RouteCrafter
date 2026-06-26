import { NextResponse } from "next/server";
import { withUser } from "@/lib/api/route-handler";
import { deleteTemplateForUser } from "@/lib/db/templates";

export const dynamic = "force-dynamic";

export const DELETE = withUser(async (
  { requestUser },
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await context.params;
  await deleteTemplateForUser({ user: requestUser, templateId: id });
  return NextResponse.json({ ok: true });
});
