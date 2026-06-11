import type { CSSProperties } from "react";
import type { PdfTheme } from "@/lib/types";

/** A document color theme expressed as raw CSS color values. */
export interface DocTheme {
  id: PdfTheme;
  label: string;
  /** Outer page background (behind the paper). */
  bg: string;
  /** Paper surface the content sits on. */
  paper: string;
  /** Primary text. */
  ink: string;
  inkSoft: string;
  inkMuted: string;
  /** Accent for eyebrows, day numbers, rules. */
  accent: string;
  /** Soft accent for chips / fills. */
  accentSoft: string;
  border: string;
  /** Text drawn on top of the accent color. */
  onAccent: string;
}

export const DOC_THEMES: DocTheme[] = [
  {
    id: "beige",
    label: "Beige",
    bg: "#efe7d6",
    paper: "#fbf8f1",
    ink: "#3a3328",
    inkSoft: "#6a6051",
    inkMuted: "#9a8e78",
    accent: "#b5764f",
    accentSoft: "#f1ddcc",
    border: "#e2d6bf",
    onAccent: "#fbf8f1",
  },
  {
    id: "sage",
    label: "Sage",
    bg: "#e4ecdd",
    paper: "#fbfcf8",
    ink: "#2b3a2e",
    inkSoft: "#52614f",
    inkMuted: "#8a9682",
    accent: "#4f7a55",
    accentSoft: "#dfead6",
    border: "#d6e2c9",
    onAccent: "#fbfcf8",
  },
  {
    id: "terracotta",
    label: "Terracotta",
    bg: "#f3e1d6",
    paper: "#fdf7f2",
    ink: "#43271c",
    inkSoft: "#735146",
    inkMuted: "#a98473",
    accent: "#c0623c",
    accentSoft: "#f4d8c7",
    border: "#ecd2c2",
    onAccent: "#fdf7f2",
  },
  {
    id: "teal",
    label: "Teal",
    bg: "#dde9e8",
    paper: "#f7fbfa",
    ink: "#1f3534",
    inkSoft: "#48605f",
    inkMuted: "#7c9594",
    accent: "#3f7c7b",
    accentSoft: "#d6e8e6",
    border: "#cadfdd",
    onAccent: "#f7fbfa",
  },
  {
    id: "noir",
    label: "Noir",
    bg: "#e6e3dd",
    paper: "#ffffff",
    ink: "#1c1b19",
    inkSoft: "#494640",
    inkMuted: "#8b8884",
    accent: "#1c1b19",
    accentSoft: "#e9e6df",
    border: "#dad6cd",
    onAccent: "#ffffff",
  },
];

export const DEFAULT_THEME_ID: PdfTheme = "beige";

export function getTheme(id: PdfTheme | undefined): DocTheme {
  return DOC_THEMES.find((t) => t.id === id) ?? DOC_THEMES[0];
}

/** CSS custom properties consumed by the `.rc-doc` styles. */
export function themeVars(theme: DocTheme): CSSProperties {
  return {
    "--doc-bg": theme.bg,
    "--doc-paper": theme.paper,
    "--doc-ink": theme.ink,
    "--doc-ink-soft": theme.inkSoft,
    "--doc-ink-muted": theme.inkMuted,
    "--doc-accent": theme.accent,
    "--doc-accent-soft": theme.accentSoft,
    "--doc-border": theme.border,
    "--doc-on-accent": theme.onAccent,
  } as CSSProperties;
}
