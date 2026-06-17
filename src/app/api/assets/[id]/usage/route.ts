import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import {
  clearAssetUsage,
  createAssetUsage,
  getAsset,
} from "@/lib/db/assets";
import { ensureRequestUser } from "@/lib/db/request-user";
import { assetUsageTypeSchema } from "@/lib/persistence/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const { id } = await context.params;
    const asset = await getAsset(id);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }
    const body = await request.json();
    const usageType = assetUsageTypeSchema.safeParse(body.usageType);
    if (!usageType.success || typeof body.fieldPath !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid asset usage payload." },
        { status: 400 },
      );
    }
    await createAssetUsage({
      assetId: id,
      projectId: asset.projectId,
      userId: requestUser.id,
      usageType: usageType.data,
      entityId: typeof body.entityId === "string" ? body.entityId : null,
      fieldPath: body.fieldPath,
      projectRevision:
        typeof body.projectRevision === "number" ? body.projectRevision : null,
      replaceExisting: body.replaceExisting !== false,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    await ensureRequestUser(user);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    await clearAssetUsage({
      assetId: id,
      fieldPath: typeof body.fieldPath === "string" ? body.fieldPath : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
