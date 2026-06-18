import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  /** Action area, typically a <Button>. */
  action?: ReactNode;
  className?: string;
}

/**
 * Canonical empty / placeholder surface. Replaces the ad-hoc dashed-border
 * boxes scattered across BuildStage, PackageStage, etc. so empty states share
 * one consistent treatment.
 */
export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "grid min-h-72 place-items-center rounded-2xl border border-dashed border-border-strong bg-paper/25 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="max-w-md">
        {Icon ? (
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-sage-soft/70 text-forest">
            <Icon className="size-6" />
          </span>
        ) : null}
        {eyebrow ? <p className="rc-eyebrow">{eyebrow}</p> : null}
        <h3 className={cn("rc-section-title text-2xl", eyebrow && "mt-2")}>
          {title}
        </h3>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
        ) : null}
        {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
