import { z } from "zod";
import { searchGeocodeCandidates } from "@/lib/geocoding/provider";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  query: z.string().trim().min(1),
  country: z.string().trim().optional(),
  limit: z.number().int().min(1).max(5).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Missing geocoding query." }, { status: 400 });
  }
  try {
    const candidates = await searchGeocodeCandidates(parsed.data);
    return Response.json({ candidates });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not search geocoding candidates.",
      },
      { status: 502 },
    );
  }
}
