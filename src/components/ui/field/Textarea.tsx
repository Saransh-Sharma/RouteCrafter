import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-xl border border-border-strong bg-paper px-3.5 py-2.5 text-sm text-ink shadow-[inset_0_1px_2px_rgba(44,42,36,0.03)] outline-none transition-colors placeholder:text-ink-muted focus:border-forest/50 focus:ring-2 focus:ring-sage/40";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grow the textarea to fit its content (recomputes on value change). */
  autoSize?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, autoSize = false, value, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    React.useLayoutEffect(() => {
      if (!autoSize) return;
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [autoSize, value]);

    return (
      <textarea
        ref={innerRef}
        rows={rows}
        value={value}
        className={cn(
          fieldBase,
          autoSize ? "resize-none overflow-hidden" : "resize-y",
          "leading-relaxed",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
