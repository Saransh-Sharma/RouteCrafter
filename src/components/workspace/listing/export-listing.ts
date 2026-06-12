import type { MarketplaceListing, Project } from "@/lib/types";

/** Listing -> Markdown document. */
export function listingToMarkdown(
  listing: MarketplaceListing,
  project: Project,
): string {
  const lines: string[] = [`# ${project.country || "Country"} - Listing Copy\n`];

  if (listing.titleOptions.length) {
    lines.push("## Title options");
    listing.titleOptions.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push("");
  }

  if (listing.tags.length) {
    lines.push(`**Tags:** ${listing.tags.join(", ")}\n`);
  }

  if (listing.shortDescription) {
    lines.push(`## Short description\n\n${listing.shortDescription}\n`);
  }
  if (listing.longDescription) {
    lines.push(`## Long description\n\n${listing.longDescription}\n`);
  }

  if (listing.packages.length) {
    lines.push("## Packages");
    for (const pkg of listing.packages) {
      lines.push(`### ${pkg.name}${pkg.price ? ` - ${pkg.price}` : ""}`);
      if (pkg.description) lines.push(pkg.description);
      for (const f of pkg.features) lines.push(`- ${f}`);
      lines.push("");
    }
  }

  if (listing.faqs.length) {
    lines.push("## FAQ");
    for (const faq of listing.faqs) {
      lines.push(`**${faq.question}**`);
      lines.push(`${faq.answer}\n`);
    }
  }

  if (listing.buyerRequirements.length) {
    lines.push("## Buyer requirements");
    for (const r of listing.buyerRequirements) lines.push(`- ${r}`);
    lines.push("");
  }

  if (listing.upsells.length) {
    lines.push("## Upsells");
    for (const u of listing.upsells) lines.push(`- ${u}`);
    lines.push("");
  }

  if (listing.deliveryNotes) {
    lines.push(`## Delivery notes\n\n${listing.deliveryNotes}`);
  }

  return lines.join("\n");
}

export function downloadListingMarkdown(
  listing: MarketplaceListing,
  project: Project,
) {
  const slug = (project.country || "project").toLowerCase();
  const blob = new Blob([listingToMarkdown(listing, project)], {
    type: "text/markdown",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-listing.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
