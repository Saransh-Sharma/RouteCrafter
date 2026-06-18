"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "./Toast";

export interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

export function CopyButton({ value, label = "Copy", className }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast("Copied to clipboard");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("Couldn't copy to clipboard", "error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-paper/70 px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-forest/40 hover:text-ink",
        className,
      )}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? (
        <Check className="size-3.5 text-forest" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}
