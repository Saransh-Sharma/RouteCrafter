import {
  LayoutDashboard,
  FolderOpen,
  LibraryBig,
  BookOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Matches the route prefix for active highlighting. */
  match: (pathname: string) => boolean;
}

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    match: (p) => p === "/",
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderOpen,
    match: (p) => p.startsWith("/projects"),
  },
  {
    label: "Templates",
    href: "/templates",
    icon: LibraryBig,
    match: (p) => p.startsWith("/templates"),
  },
  {
    label: "Guide",
    href: "/guide",
    icon: BookOpen,
    match: (p) => p.startsWith("/guide"),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    match: (p) => p.startsWith("/settings"),
  },
];
