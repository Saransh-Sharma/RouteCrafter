import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-xl border border-border-strong bg-paper px-3.5 py-2.5 text-sm text-ink shadow-[inset_0_1px_2px_rgba(44,42,36,0.03)] outline-none transition-colors placeholder:text-ink-muted focus:border-forest/50 focus:ring-2 focus:ring-sage/40";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input ref={ref} className={cn(fieldBase, "h-11", className)} {...props} />
  );
});
Input.displayName = "Input";
