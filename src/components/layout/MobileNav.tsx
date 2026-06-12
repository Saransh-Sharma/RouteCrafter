"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { navItems } from "./nav";
import { Brand } from "./Sidebar";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";

const AVATAR_COLORS: Record<string, string> = {
  user_admin: "bg-forest text-paper",
  user_saransh: "bg-terracotta text-paper",
  user_saumya: "bg-teal text-paper",
};

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = React.useState(false);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-paper/85 backdrop-blur-md lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Brand />
        {user && (
          <div className="relative">
            <button
              type="button"
              id="mobile-user-menu-btn"
              aria-label="Open user menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-shadow",
                AVATAR_COLORS[user.id] ?? "bg-sage text-paper",
                menuOpen && "ring-2 ring-forest/30",
              )}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-border-soft bg-paper p-2 shadow-[var(--shadow-lift)]">
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold text-ink">
                      {user.displayName}
                    </p>
                    <p className="text-[11px] text-ink-muted">{user.email}</p>
                  </div>
                  <div className="my-1 h-px bg-border-soft" />
                  <button
                    type="button"
                    id="mobile-logout-btn"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-terracotta/10 hover:text-terracotta"
                  >
                    <LogOut className="size-4" />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
        {navItems.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sage-soft text-forest"
                  : "text-ink-soft hover:bg-paper-2/70",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
