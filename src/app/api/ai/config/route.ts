import { NextResponse, type NextRequest } from "next/server";
import { getPublicAiConfig } from "@/lib/ai/credentials";
import { getRequestUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await getRequestUser(request))) return unauthorizedResponse();

  return NextResponse.json(getPublicAiConfig(), {
    headers: { "Cache-Control": "no-store" },
  });
}
