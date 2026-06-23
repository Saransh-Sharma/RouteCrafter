import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { ensureRequestUser } from "@/lib/db/request-user";
import { listTemplates, upsertTemplateForUser } from "@/lib/db/templates";
import { templateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    await ensureRequestUser(user);
    return NextResponse.json(
      { templates: await listTemplates(user) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Missing or invalid template payload." },
        { status: 400 },
      );
    }
    const parsed = templateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid template payload." },
        { status: 400 },
      );
    }
    return NextResponse.json({
      template: await upsertTemplateForUser({
        user: requestUser,
        template: parsed.data,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
