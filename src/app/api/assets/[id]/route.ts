import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { deleteBlobAsset } from "@/lib/blob";
import {
  countActiveAssetUsages,
  getAsset,
  softDeleteAsset,
} from "@/lib/db/assets";
import { createAuditEvent } from "@/lib/db/audit";
import { ensureRequestUser } from "@/lib/db/request-user";

export const dynamic = "force-dynamic";

export async function DELETE(
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
    const activeUsages = await countActiveAssetUsages({ assetId: id });
    if (activeUsages > 0) {
      return NextResponse.json(
        {
          error:
            "This asset is still used in a project. Clear or replace it before deleting.",
          activeUsages,
        },
        { status: 409 },
      );
    }
    await deleteBlobAsset(asset.blobUrl);
    await softDeleteAsset({ assetId: id });
    await createAuditEvent({
      request,
      userId: requestUser.id,
      eventType: "asset.delete",
      metadata: { assetId: id, activeUsages },
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, blobDeleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
