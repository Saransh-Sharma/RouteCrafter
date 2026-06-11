"use client";

import * as React from "react";

/**
 * Returns false during SSR and the first client paint, then true after mount.
 * Use to gate localStorage-backed UI so server and client first render match
 * (avoids hydration mismatches with the persisted projects store).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}
