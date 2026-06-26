import { NextResponse } from "next/server";
import { jsonNoStore, parseBody, withUser } from "@/lib/api/route-handler";
import { listTemplates, upsertTemplateForUser } from "@/lib/db/templates";
import { templateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const GET = withUser(async ({ user }) =>
  jsonNoStore({ templates: await listTemplates(user) }),
);

export const POST = withUser(async ({ requestUser }, request: Request) => {
  const parsed = await parseBody(
    request,
    templateSchema,
    "Missing or invalid template payload.",
  );
  if (!parsed.ok) return parsed.response;
  return NextResponse.json({
    template: await upsertTemplateForUser({
      user: requestUser,
      template: parsed.data,
    }),
  });
});
