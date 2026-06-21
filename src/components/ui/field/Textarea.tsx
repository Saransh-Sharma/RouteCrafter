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

    // Grow the element to fit its content. Reads scrollHeight, so it only
    // produces a correct value when the textarea is actually laid out.
    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    // Runs on mount and whenever the value changes.
    React.useLayoutEffect(() => {
      if (autoSize) resize();
    }, [autoSize, value, resize]);

    // Re-measure when the textarea becomes visible (e.g. a collapsed day card
    // expands) or its width changes (responsive re-wrap). A display:none →
    // visible transition and any column re-wrap both fire the observer.
    React.useEffect(() => {
      if (!autoSize) return;
      const el = innerRef.current;
      if (!el || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(() => resize());
      observer.observe(el);
      return () => observer.disconnect();
    }, [autoSize, resize]);

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
