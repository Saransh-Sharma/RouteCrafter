import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { getAssetFacets, listAssets } from "@/lib/db/assets";
import { ensureRequestUser } from "@/lib/db/request-user";
import { assetTypeSchema } from "@/lib/persistence/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const url = new URL(request.url);
    const parsedType = assetTypeSchema.safeParse(url.searchParams.get("assetType"));
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? 60)),
    );
    const assets = await listAssets({
      userId: requestUser.id,
      limit,
      cursor: url.searchParams.get("cursor"),
      projectId: url.searchParams.get("projectId"),
      country: url.searchParams.get("country"),
      assetType: parsedType.success ? parsedType.data : null,
    });
    const facets = await getAssetFacets(requestUser.id);
    return NextResponse.json({ assets, facets });
  } catch (error) {
    return errorResponse(error);
  }
}
