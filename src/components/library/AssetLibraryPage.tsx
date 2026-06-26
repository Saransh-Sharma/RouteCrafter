"use client";

import * as React from "react";
import { Copy, Download, FileText, Images, Trash2, X } from "lucide-react";
import type { AssetDTO, AssetType } from "@/lib/persistence/types";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  deleteAsset as deleteCloudAsset,
  listAssets,
} from "@/lib/client/assets-api";
import { cn } from "@/lib/utils";

const TYPES: { id: AssetType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "cover-image", label: "Covers" },
  { id: "day-image", label: "Day images" },
  { id: "portfolio-visual", label: "Portfolio" },
  { id: "pdf", label: "PDFs" },
  { id: "markdown-export", label: "Markdown" },
  { id: "csv-export", label: "CSV" },
  { id: "json-export", label: "JSON" },
];

export function AssetLibraryPage() {
  const [assets, setAssets] = React.useState<AssetDTO[]>([]);
  const [facets, setFacets] = React.useState<{
    countries: string[];
    assetTypes: AssetType[];
  }>({ countries: [], assetTypes: [] });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [country, setCountry] = React.useState("all");
  const [type, setType] = React.useState<AssetType | "all">("all");
  const [selected, setSelected] = React.useState<AssetDTO | null>(null);

  React.useEffect(() => {
    let active = true;
    listAssets({
      limit: 100,
      country: country === "all" ? undefined : country,
      assetType: type === "all" ? undefined : type,
    })
      .then((body) => {
        if (active) {
          setAssets(body.assets ?? []);
          setFacets({
            countries: body.facets?.countries ?? [],
            assetTypes: body.facets?.assetTypes ?? [],
          });
          setError(null);
        }
      })
      .catch((loadError) => {
        if (active) {
          setAssets([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load assets.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [country, type]);

  const countries = React.useMemo(() => ["all", ...facets.countries], [facets]);
  const types = React.useMemo(() => {
    const available = new Set<AssetType>(facets.assetTypes);
    return TYPES.filter((item) => item.id === "all" || available.has(item.id));
  }, [facets]);

  async function deleteAsset(asset: AssetDTO) {
    const result = await deleteCloudAsset(asset.id);
    if (!result.ok) {
      setError(result.body.error ?? "Could not delete asset.");
      return;
    }
    setAssets((current) => current.filter((item) => item.id !== asset.id));
    setSelected(null);
    setError(null);
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Asset Library"
        title="Saved visuals and delivery files"
        subtitle="Browse cloud-saved images, PDFs, and exports generated or uploaded from your projects."
      />

      <div className="grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Country
            </p>
            <div className="space-y-1">
              {countries.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCountry(item)}
                  className={cn(
                    "block w-full rounded-xl px-3 py-2 text-left text-sm font-medium",
                    country === item
                      ? "bg-sage-soft text-forest"
                      : "text-ink-soft hover:bg-paper-2/70 hover:text-ink",
                  )}
                >
                  {item === "all" ? "All countries" : item}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="flex flex-wrap gap-2">
            {types.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setType(item.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  type === item.id
                    ? "border-forest bg-sage-soft text-forest"
                    : "border-border-strong text-ink-soft hover:text-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {error ? <p className="text-sm text-terracotta">{error}</p> : null}
          {loading ? (
            <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-paper-2/40" />
          ) : assets.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelected(asset)}
                  className="overflow-hidden rounded-[var(--radius-card)] border border-border-soft bg-paper/55 text-left transition-colors hover:border-forest/40"
                >
                  {asset.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.blobUrl}
                      alt={asset.filename}
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-44 place-items-center bg-paper-2/50 text-terracotta">
                      <FileText className="size-10" />
                    </div>
                  )}
                  <div className="space-y-1 p-3">
                    <p className="truncate text-sm font-semibold text-ink">
                      {asset.filename}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {asset.country || "No country"} · {asset.assetType}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center border border-dashed border-border-strong text-center">
              <div>
                <Images className="mx-auto size-10 text-ink-muted" />
                <p className="mt-3 text-sm font-semibold text-ink">
                  No saved assets yet
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {selected ? (
        <AssetModal
          asset={selected}
          onClose={() => setSelected(null)}
          onDelete={() => deleteAsset(selected)}
        />
      ) : null}
    </div>
  );
}

function AssetModal({
  asset,
  onClose,
  onDelete,
}: {
  asset: AssetDTO;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <div className="max-h-[92dvh] w-full max-w-4xl overflow-hidden rounded-[var(--radius-card)] border border-border-strong bg-paper shadow-[var(--shadow-lift)]">
        <div className="flex items-center justify-between border-b border-border-soft p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{asset.filename}</p>
            <p className="text-xs text-ink-muted">{asset.assetType}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-ink-soft">
            <X className="size-5" />
          </button>
        </div>
        <div className="max-h-[65dvh] overflow-auto bg-paper-2/40 p-4">
          {asset.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.blobUrl} alt={asset.filename} className="mx-auto max-h-[60dvh]" />
          ) : (
            <div className="grid min-h-80 place-items-center text-terracotta">
              <FileText className="size-16" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 p-4">
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(asset.blobUrl)}>
            <Copy className="size-4" />
            Copy URL
          </Button>
          <a
            href={asset.blobUrl}
            download={asset.filename}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border-strong px-3.5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            <Download className="size-4" />
            Download
          </a>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
