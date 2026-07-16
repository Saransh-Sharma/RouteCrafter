import { LayoutGrid, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Matches the route prefix for active highlighting. */
  match: (pathname: string) => boolean;
}

/**
 * The whole IA is two nouns: Products (the shelf, which is home) and
 * Settings. Everything else is contextual inside the product editor.
 */
export const navItems: NavItem[] = [
  {
    label: "Products",
    href: "/",
    icon: LayoutGrid,
    match: (p) => p === "/" || p.startsWith("/products") || p.startsWith("/series"),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    match: (p) => p.startsWith("/settings"),
  },
];
