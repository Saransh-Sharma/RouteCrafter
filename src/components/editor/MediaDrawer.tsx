"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { Images, Loader2, Upload } from "lucide-react";
import type { AssetDTO, AssetType } from "@/lib/persistence/types";
import { listAssets, uploadAsset } from "@/lib/client/assets-api";
import { Dialog } from "@/components/ui/overlay/Dialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * The media library as a picker: browse cloud-saved images or upload a new
 * one, then hand the chosen URL back to the image slot that opened it.
 * Replaces the standalone /library page.
 */
export function MediaDrawer({
  open,
  onClose,
  onPick,
  projectId,
  country,
  assetType = "cover-image",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (asset: AssetDTO) => void;
  projectId?: string;
  country?: string;
  assetType?: AssetType;
}) {
  const [assets, setAssets] = React.useState<AssetDTO[]>([]);
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "country">(
    country ? "country" : "all",
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const requestKey = `${filter}:${country ?? ""}`;
  const loading = loadedKey !== requestKey;

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    listAssets({
      limit: 100,
      country: filter === "country" ? country : undefined,
    })
      .then((body) => {
        if (!active) return;
        setAssets(
          (body.assets ?? []).filter((asset) =>
            asset.mimeType.startsWith("image/"),
          ),
        );
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setAssets([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load assets.",
        );
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [open, filter, country, requestKey]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("filename", file.name);
      form.set("assetType", assetType);
      form.set("source", "upload");
      if (projectId) form.set("projectId", projectId);
      const body = await uploadAsset(form);
      if (body.asset) {
        setAssets((current) => [body.asset!, ...current]);
        onPick(body.asset);
        onClose();
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload the image.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Media library"
      description="Pick a saved image or upload a new one."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <FilterChip
            label="All images"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          {country ? (
            <FilterChip
              label={country}
              active={filter === "country"}
              onClick={() => setFilter("country")}
            />
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUpload(file);
            event.target.value = "";
          }}
        />
        <Button
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? "Uploading…" : "Upload image"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-terracotta">{error}</p> : null}

      <div className="mt-4">
        {loading ? (
          <div className="h-56 animate-pulse rounded-[var(--radius-card)] bg-paper-2/40" />
        ) : assets.length ? (
          <div className="grid max-h-[50dvh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => {
                  onPick(asset);
                  onClose();
                }}
                className="group overflow-hidden rounded-[var(--radius-control)] border border-border-soft text-left transition-colors hover:border-forest/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
              >
                <img
                  src={asset.blobUrl}
                  alt={asset.filename}
                  className="aspect-[3/2] w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
                <p className="truncate px-2 py-1.5 text-[11px] font-medium text-ink-soft">
                  {asset.filename}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center rounded-[var(--radius-card)] border border-dashed border-border-strong text-center">
            <div>
              <Images className="mx-auto size-8 text-ink-muted" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-ink">
                No saved images yet
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Upload one, or generate images from the Listing tab.
              </p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-forest bg-sage-soft text-forest"
          : "border-border-strong text-ink-soft hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
