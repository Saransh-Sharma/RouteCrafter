"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, LogOut, Plus, Search } from "lucide-react";
import { navItems } from "./nav";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { useSyncStatus } from "@/lib/store/projects-store";
import { Popover, usePopoverClose } from "@/components/ui/overlay/Popover";
import { OPEN_PALETTE_EVENT } from "./CommandPalette";

const AVATAR_COLORS: Record<string, string> = {
  user_admin: "bg-forest text-paper",
  user_saransh: "bg-terracotta text-paper",
  user_saumya: "bg-teal text-paper",
};

/**
 * The app's single navigation surface: a slim editorial top bar. Replaces
 * the old sidebar + mobile header pair.
 */
export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-ivory/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-5 py-3 sm:px-8">
        <Brand />

        <nav className="ml-2 hidden min-w-0 items-center gap-1 overflow-x-auto md:flex">
          {navItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-caption font-medium transition-colors",
                  active
                    ? "bg-sage-soft text-forest"
                    : "text-ink-soft hover:bg-paper-2/70 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SaveIndicator />
          <button
            type="button"
            aria-label="Search (⌘K)"
            onClick={() =>
              window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))
            }
            className="hidden items-center gap-2 rounded-full border border-border-soft bg-paper px-3 py-1.5 text-caption text-ink-muted transition-colors hover:border-border-strong hover:text-ink sm:flex"
          >
            <Search className="size-3.5" aria-hidden />
            Search
            <kbd className="rounded bg-paper-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
              ⌘K
            </kbd>
          </button>
          <Link
            href="/products/new"
            className="flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-caption font-medium text-paper shadow-[var(--shadow-soft)] transition-colors hover:bg-forest-deep"
          >
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">New product</span>
          </Link>
          <AccountMenu />
        </div>
      </div>

      {/* Mobile nav row */}
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2.5 md:hidden">
        {navItems.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-caption font-medium transition-colors",
                active
                  ? "bg-sage-soft text-forest"
                  : "text-ink-soft hover:bg-paper-2/70",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function SaveIndicator() {
  const saveState = useSyncStatus();
  if (saveState.status === "idle") return null;

  const labels: Record<string, string> = {
    saving: "Saving…",
    saved: "Saved",
    error: "Save failed",
  };

  return (
    <span
      data-save-state={saveState.status}
      title={saveState.error ?? undefined}
      className={cn(
        "hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline",
        saveState.status === "error"
          ? "bg-terracotta-soft text-terracotta"
          : "text-ink-muted",
      )}
    >
      {labels[saveState.status]}
    </span>
  );
}

function AccountMenu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  return (
    <Popover
      align="end"
      trigger={(props) => (
        <button
          type="button"
          id="topbar-user-menu-btn"
          aria-label="Open account menu"
          className={cn(
            "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-shadow",
            AVATAR_COLORS[user.id] ?? "bg-sage text-paper",
            props["aria-expanded"] && "ring-2 ring-forest/30",
          )}
          {...props}
        >
          {user.displayName.charAt(0).toUpperCase()}
        </button>
      )}
    >
      <AccountPanel
        displayName={user.displayName}
        email={user.email}
        onLogout={async () => {
          await logout();
          router.push("/login");
        }}
      />
    </Popover>
  );
}

function AccountPanel({
  displayName,
  email,
  onLogout,
}: {
  displayName: string;
  email: string;
  onLogout: () => Promise<void>;
}) {
  const close = usePopoverClose();

  return (
    <div className="w-52">
      <div className="px-3 py-2">
        <p className="truncate text-caption font-semibold text-ink">
          {displayName}
        </p>
        <p className="truncate text-[11px] text-ink-muted">{email}</p>
      </div>
      <div className="my-1 h-px bg-border-soft" />
      <button
        type="button"
        id="topbar-logout-btn"
        onClick={async () => {
          close();
          await onLogout();
        }}
        className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-caption font-medium text-ink-soft transition-colors hover:bg-terracotta/10 hover:text-terracotta"
      >
        <LogOut className="size-4" aria-hidden />
        Logout
      </button>
    </div>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex shrink-0 items-center gap-2.5", className)}>
      <span className="flex size-8 items-center justify-center rounded-xl bg-forest text-paper shadow-[var(--shadow-soft)]">
        <Compass className="size-4.5" />
      </span>
      <span className="font-display text-base font-semibold text-ink">
        RouteCrafter
      </span>
    </Link>
  );
}
