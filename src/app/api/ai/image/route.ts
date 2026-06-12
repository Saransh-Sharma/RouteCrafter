import { NextResponse, type NextRequest } from "next/server";
import { aiImageRequestSchema } from "@/lib/ai/schemas";
import { generateImage, normalizeProviderError } from "@/lib/ai/provider-adapters";
import { getRequestUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!(await getRequestUser(request))) return unauthorizedResponse();

    const json = await request.json();
    const parsed = aiImageRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid AI image request." },
        { status: 400 },
      );
    }
    const result = await generateImage(parsed.data);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: normalizeProviderError(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
