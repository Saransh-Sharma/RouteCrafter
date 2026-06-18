import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Convenience: render as a circle. */
  circle?: boolean;
}

/**
 * Shimmer placeholder for loading content. Pair several with explicit
 * width/height utility classes to mimic the shape of the content that follows.
 */
export function Skeleton({ className, circle, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "rc-skeleton",
        circle ? "rounded-full" : "rounded-lg",
        className,
      )}
      {...props}
    />
  );
}
