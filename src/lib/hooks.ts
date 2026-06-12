"use client";

import * as React from "react";

const emptySubscribe = () => () => {};

/**
 * Returns false during SSR and the first hydration render, then true on the
 * client. Uses `useSyncExternalStore` so server and client first render agree
 * (no hydration mismatch) without calling setState in an effect. Gate
 * localStorage-backed UI on this.
 */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
