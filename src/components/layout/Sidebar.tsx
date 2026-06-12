"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, LogOut, Plus, Shield, Pen } from "lucide-react";
import { navItems } from "./nav";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";

const AVATAR_COLORS: Record<string, string> = {
  user_admin: "bg-forest text-paper",
  user_saransh: "bg-terracotta text-paper",
  user_saumya: "bg-teal text-paper",
};

const ROLE_LABELS: Record<string, { label: string; icon: typeof Shield }> = {
  admin: { label: "Admin", icon: Shield },
  editor: { label: "Editor", icon: Pen },
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border-soft bg-paper/70 px-4 py-6 backdrop-blur-sm lg:flex">
      <Brand />

      <Link
        href="/projects/new"
        className="mt-8 flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-paper shadow-[var(--shadow-soft)] transition-colors hover:bg-forest-deep"
      >
        <Plus className="size-4" />
        New project
      </Link>

      <nav className="mt-8 flex flex-col gap-1">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Studio
        </p>
        {navItems.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sage-soft text-forest"
                  : "text-ink-soft hover:bg-paper-2/70 hover:text-ink",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User profile card */}
      {user ? (
        <div className="mt-auto rounded-2xl border border-border-soft bg-paper-2/50 p-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                AVATAR_COLORS[user.id] ?? "bg-sage text-paper",
              )}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {user.displayName}
              </p>
              <p className="truncate text-[11px] text-ink-muted">
                {user.email}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            {(() => {
              const roleInfo = ROLE_LABELS[user.role] ?? ROLE_LABELS.editor;
              const RoleIcon = roleInfo.icon;
              return (
                <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2.5 py-0.5 text-[11px] font-semibold text-forest">
                  <RoleIcon className="size-3" />
                  {roleInfo.label}
                </span>
              );
            })()}
            <button
              type="button"
              id="sidebar-logout-btn"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-terracotta/10 hover:text-terracotta"
            >
              <LogOut className="size-3" />
              Logout
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-auto rounded-2xl border border-border-soft bg-paper-2/50 p-4">
          <p className="text-xs font-semibold text-ink">Prompt-output mode</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Works without API keys. Connect a model later to generate in-app.
          </p>
        </div>
      )}
    </aside>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-forest text-paper shadow-[var(--shadow-soft)]">
        <Compass className="size-5" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-display text-lg font-semibold text-ink">
          RouteCrafter
        </span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          Itinerary Studio
        </span>
      </span>
    </Link>
  );
}
