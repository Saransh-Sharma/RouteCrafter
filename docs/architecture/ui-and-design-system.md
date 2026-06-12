# UI & Design System

RouteCrafter's UI is a **Next.js 16 App Router** app with a single root layout, a
hand-built design system (no Radix/shadcn), a tabbed project workspace, and a
client-side PDF builder. Most interactive pages are `"use client"` components; the
root layout is a server component that loads fonts and wraps everything in
`AppShell`.

## Routing

There is no nested layout — every page shares the root layout only.

| Route | File | Type | Purpose |
| --- | --- | --- | --- |
| `/` | [`src/app/page.tsx`](../../src/app/page.tsx) | client | Dashboard: recent projects, quick actions, import. |
| `/projects` | [`src/app/projects/page.tsx`](../../src/app/projects/page.tsx) | client | Full project grid. |
| `/projects/new` | [`src/app/projects/new/page.tsx`](../../src/app/projects/new/page.tsx) | client | Create-project form -> workspace. |
| `/projects/[id]` | [`src/app/projects/[id]/page.tsx`](../../src/app/projects/%5Bid%5D/page.tsx) | client | Project workspace (header + `WorkspaceTabs`). |
| `/templates` | [`src/app/templates/page.tsx`](../../src/app/templates/page.tsx) | server | Roadmap placeholder (`ComingSoon`). |
| `/settings` | [`src/app/settings/page.tsx`](../../src/app/settings/page.tsx) | client | AI provider keys + defaults. |
| `/api/ai/text`, `/api/ai/image` | [`src/app/api/ai`](../../src/app/api/ai) | route handlers | Server-side AI proxy (see [AI integration](ai-integration.md)). |

### Root layout

```25:41:src/app/layout.tsx
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="rc-paper-texture min-h-full text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

Fonts are loaded via `next/font/google`: **Fraunces** (display/serif,
`--font-fraunces`) and **Inter** (UI sans, `--font-inter`).

## AppShell & navigation

```6:21:src/components/layout/AppShell.tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          <div className="mx-auto w-full max-w-6xl">
            <PersistenceNotice />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

- **Desktop (lg+):** fixed 256px `Sidebar` + scrollable main column (`max-w-6xl`).
- **Mobile:** sticky `MobileNav` top bar; sidebar hidden.
- **`PersistenceNotice`** surfaces storage errors from the projects store
  (quota/save failures) with a dismiss action.

Navigation items live in [`nav.ts`](../../src/components/layout/nav.ts). Active state
uses prefix matching for `/projects/*` and `/settings/*`, exact match for `/`. The
sidebar also has a primary "New project" CTA and a "Prompt-output mode" callout
reminding users the app works without keys.

## UI component system

The design-system primitives live in
[`src/components/ui`](../../src/components/ui) (barrel: `index.ts`). They are
Tailwind + a `cn()` class merger (`clsx` + `tailwind-merge`), with no third-party
component library.

| Category | Components |
| --- | --- |
| Structure | `SectionHeader`, `Card` family (`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`), `PreviewCard` |
| Actions | `Button` (variants `primary`/`secondary`/`outline`/`ghost`; sizes `sm`/`md`/`lg`), `CopyButton`, `ExportButton` |
| Content | `Badge` (tones: sage/terracotta/teal/gold/forest/neutral), `OutputBlock` (monospace textarea with copy header) |
| Form fields (`field/`) | `FormField`, `Label`, `Input`, `Textarea`, `Select`, `CheckboxChip` |

Conventions: pill-shaped buttons/chips, `rounded-xl` inputs, forest/sage focus
rings, paper backgrounds, soft inset shadows.

## Workspace tabs

The workspace shell, [`WorkspaceTabs`](../../src/components/workspace/WorkspaceTabs.tsx),
holds the active tab in **local React state** (not the URL). The module list comes
from `workspaceModules` in [`src/lib/mock-data.ts`](../../src/lib/mock-data.ts).

```19:30:src/components/workspace/WorkspaceTabs.tsx
const IMPLEMENTED = new Set([
  "overview",
  "trip-config",
  "prompts",
  "image-prompts",
  "matrix",
  "expanded",
  "listing",
  "pdf",
  "export",
]);
```

All nine modules are implemented; an unimplemented id would render a locked
placeholder. The panel switch maps each id to its component:

```84:105:src/components/workspace/WorkspaceTabs.tsx
  switch (current.id) {
    case "overview":
      return <OverviewPanel project={project} />;
    case "trip-config":
      return <TripConfigForm project={project} />;
    case "prompts":
      return <PromptStudioPanel project={project} />;
    case "image-prompts":
      return <ImagePromptsPanel project={project} />;
    case "matrix":
      return <MatrixPanel project={project} onNavigate={onNavigate} />;
    case "expanded":
      return <ExpandedItineraryPanel project={project} />;
    case "listing":
      return <ListingPanel project={project} />;
    case "pdf":
      return <PdfBuilderPanel project={project} onNavigate={onNavigate} />;
    case "export":
      return <ExportPanel project={project} />;
```

**Cross-tab navigation** uses the `onNavigate` callback: the matrix panel sets
`expandHint` in the store and jumps to the itinerary tab; the PDF panel can jump to
the itinerary tab when no itinerary exists yet.

Each panel is described in the [user guide](../guides/user-guide.md). Notable
implementation details:

- **Trip Configuration** uses `react-hook-form` + Zod (`tripConfigurationSchema`)
  with debounced auto-save.
- **Prompt Studio** consumes the [generation engine](generation-engine.md)
  (`templatesByGroup`, `renderTemplate`) and stores output in `project.generated`.
- **Matrix / Itinerary / Listing / Image** panels combine local scaffold builders,
  a `PromptHelper` for copy-paste, and optional `AiRunSheet` flows.

## Design tokens (`globals.css`)

Tokens are defined as CSS custom properties and exposed to Tailwind via
`@theme inline` in [`globals.css`](../../src/app/globals.css).

### Palette

- **Surfaces:** ivory `#f6f1e7`, paper `#fbf8f1`, paper-2 `#f1ead9`, borders
  `#e4dbc8` / `#d6cab0`.
- **Ink:** `#2c2a24`, soft `#58534a`, muted `#8a8273`.
- **Brand:** sage, forest, terracotta, brown, teal, gold (each with soft variants).
- **AI surfaces:** a distinct gold/brown family (`--rc-ai-*`) so AI affordances read
  as "billable/premium" rather than the generic purple.

### Typography

- Body sans: Inter (`--font-sans`).
- Display serif (`.font-display`): Fraunces (`--font-serif`).
- Headings use slight negative letter-spacing.

### Other tokens & helpers

- `--radius-card: 1.25rem`; layered `--shadow-soft` / `--shadow-lift`.
- `.rc-paper-texture` (body background), `.rc-card`, `.rc-divider` utility classes.

## PDF builder {#pdf-builder}

The PDF subsystem lives in
[`src/components/workspace/pdf`](../../src/components/workspace/pdf).

| Piece | Role |
| --- | --- |
| `ItineraryDocument` | Renders a multi-page A4 document (cover, overview, day pages, guides, disclaimer) using `.rc-doc` and inline `--doc-*` theme variables. |
| `themes.ts` | Five themes (beige, sage, terracotta, teal, noir) mapped to `--doc-*` CSS variables via `themeVars(theme)`. |
| `PdfThemeControls` | Per-itinerary theme + cover/day images; upload (compressed via `compressImageFile`) or AI generation. |
| `PdfBuilderPanel` | Orchestrates preview + export; tracks image-load completion. |

The document styles live in `globals.css` (`.rc-doc`, `.rc-print-page`, cover scrim,
print `@page` A4) and use concrete color values **independent of the app chrome** so
`html2canvas` captures them correctly.

### Export paths

Two ways to produce a PDF:

1. **Native print** — `window.print()`, with `@media print` rules that hide app
   chrome (`.rc-no-print`), isolate the print root, force A4 page breaks, and enable
   `print-color-adjust: exact`.
2. **Download** — dynamic-imports `html2pdf.js`:

```47:72:src/components/workspace/pdf/PdfBuilderPanel.tsx
  async function downloadPdf() {
    if (!docRef.current || !selected) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await prepareDocumentForPdf(docRef.current);
      const html2pdf = (await import("html2pdf.js")).default;
      const slug = (project.country || "project").toLowerCase();
      await html2pdf()
        .set({
          margin: 0,
          filename: `${slug}-${selected.duration.replace(/\s+/g, "")}-itinerary.pdf`,
          image: { type: "jpeg", quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(docRef.current)
        .save();
    } catch (error) {
      // ...
    }
  }
```

`prepareDocumentForPdf` waits for `document.fonts.ready` and all images to load/decode,
and probes remote images for CORS-safe canvas embeddability — if a remote image
can't be captured, it throws and the user is directed to upload the image or use the
native print path.

## Broader export (non-PDF)

Beyond PDF, the [Export panel](../guides/user-guide.md) and the header
`ExportButton` use helpers in
[`export-bundle.ts`](../../src/components/workspace/export/export-bundle.ts)
(`buildMarkdownBundle`, `itineraryToCsv`, `promptsToMarkdown`,
`buildAiUsageAppendix`) and [`project-io.ts`](../../src/lib/io/project-io.ts) for JSON.
PDF export is intentionally **not** in the header dropdown — it lives only in the PDF
Builder tab.

## High-level UI map

```mermaid
flowchart TB
  Layout["layout.tsx (fonts + AppShell)"] --> Shell
  subgraph Shell[AppShell]
    Nav["Sidebar / MobileNav"]
    Notice[PersistenceNotice]
    Main["max-w-6xl main"]
  end
  Main --> Pages["Dashboard / Projects / New / Workspace / Settings"]
  Pages --> Store["Zustand stores (localStorage)"]
  Workspace["/projects/[id]"] --> Tabs[WorkspaceTabs]
  Tabs --> Panels["9 panels"]
  Panels --> PDF["PDF Builder -> html2pdf.js + ItineraryDocument"]
```
