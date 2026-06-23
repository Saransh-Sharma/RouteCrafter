"use client";

import * as React from "react";
import { useToast } from "@/components/ui/Toast";

export function useUndoableAction() {
  const { toast } = useToast();

  return React.useCallback(
    ({
      message,
      undoLabel = "Undo",
      durationMs = 6000,
      onUndo,
      onExpire,
    }: {
      message: string;
      undoLabel?: string;
      durationMs?: number;
      onUndo: () => void;
      onExpire?: () => void;
    }) => {
      let completed = false;
      return toast({
        message,
        tone: "info",
        actionLabel: undoLabel,
        durationMs,
        onAction: () => {
          completed = true;
          onUndo();
        },
        onDismiss: (reason) => {
          if (completed) return;
          completed = true;
          if (reason === "timeout") onExpire?.();
        },
      });
    },
    [toast],
  );
}
