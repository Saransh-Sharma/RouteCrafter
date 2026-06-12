import { NextResponse } from "next/server";
import { aiTextRequestSchema } from "@/lib/ai/schemas";
import { generateText, normalizeProviderError } from "@/lib/ai/provider-adapters";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = aiTextRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid AI text request." },
        { status: 400 },
      );
    }
    const result = await generateText(parsed.data);
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
