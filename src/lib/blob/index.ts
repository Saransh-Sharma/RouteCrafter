import "server-only";

import { del, put } from "@vercel/blob";

export class BlobConfigurationError extends Error {
  status = 503;
}

function getBlobAuthOptions(): { token?: string } {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return { token: process.env.BLOB_READ_WRITE_TOKEN };
  }
  if (process.env.BLOB_STORE_ID) {
    return {};
  }
  throw new BlobConfigurationError(
    "Blob storage is not configured. Connect Vercel Blob and set either BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN.",
  );
}

function getBlobDeletionOptions(): { token?: string } {
  const options = getBlobAuthOptions();
  if (!options.token && process.env.VERCEL !== "1") {
    throw new BlobConfigurationError(
      "BLOB_READ_WRITE_TOKEN is required for local Blob deletes. Pull Vercel Blob credentials locally or run this on Vercel with OIDC.",
    );
  }
  return options;
}

export async function uploadBlobAsset({
  body,
  pathname,
  contentType,
}: {
  body: File | Blob | ArrayBuffer | Buffer;
  pathname: string;
  contentType: string;
}) {
  return put(pathname, body, {
    access: "public",
    contentType,
    ...getBlobAuthOptions(),
  });
}

export async function deleteBlobAsset(urlOrPathname: string): Promise<void> {
  await del(urlOrPathname, getBlobDeletionOptions());
}
