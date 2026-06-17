import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/auth/http";
import { errorResponse } from "@/lib/api/errors";
import { deleteBlobAsset, uploadBlobAsset } from "@/lib/blob";
import { createActivity } from "@/lib/db/activity";
import { createAsset } from "@/lib/db/assets";
import { getProject } from "@/lib/db/projects";
import { ensureRequestUser } from "@/lib/db/request-user";
import {
  assetSourceSchema,
  assetTypeSchema,
} from "@/lib/persistence/types";

export const dynamic = "force-dynamic";

const MAX_ASSET_BYTES = 25 * 1024 * 1024;

function safeName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "asset"
  );
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse();
    const requestUser = await ensureRequestUser(user);
    const form = await request.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") ?? "");
    const assetType = assetTypeSchema.safeParse(form.get("assetType"));
    const source = assetSourceSchema.safeParse(form.get("source"));
    const editionLabel = form.get("editionLabel");
    const filename = safeName(String(form.get("filename") || "asset"));

    if (!(file instanceof File) || !projectId || !assetType.success || !source.success) {
      return NextResponse.json(
        { error: "Missing or invalid asset upload payload." },
        { status: 400 },
      );
    }
    if (file.size > MAX_ASSET_BYTES) {
      return NextResponse.json(
        { error: "Asset is too large. Keep uploads under 25MB." },
        { status: 413 },
      );
    }
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const blob = await uploadBlobAsset({
      body: file,
      pathname: `shared/${projectId}/${Date.now()}-${filename}`,
      contentType: file.type || "application/octet-stream",
    });
    try {
      const asset = await createAsset({
        projectId,
        userId: requestUser.id,
        country: project.project.country,
        editionLabel: editionLabel ? String(editionLabel) : null,
        assetType: assetType.data,
        source: source.data,
        filename,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        blobUrl: blob.url,
        blobPathname: blob.pathname,
      });
      await createActivity({
        projectId,
        ownerUserId: requestUser.id,
        actor: requestUser,
        action: "updated",
        detail: `Saved ${assetType.data} asset "${filename}"`,
        entityType: "asset",
        entityId: asset.id,
      });
      return NextResponse.json({ asset });
    } catch (dbError) {
      await deleteBlobAsset(blob.url).catch(() => undefined);
      throw dbError;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
