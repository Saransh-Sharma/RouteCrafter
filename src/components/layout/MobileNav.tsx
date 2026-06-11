"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav";
import { Brand } from "./Sidebar";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-paper/85 backdrop-blur-md lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Brand />
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
