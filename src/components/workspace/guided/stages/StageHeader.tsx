import type { ReactNode } from "react";

export function StageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <header className="grid gap-5 border-b border-border-soft pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          {description}
        </p>
      </div>
      {aside}
    </header>
  );
}
