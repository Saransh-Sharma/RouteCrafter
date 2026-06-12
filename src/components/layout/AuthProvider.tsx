"use client";

import * as React from "react";
import { useAuthStore } from "@/lib/store/auth-store";

/**
 * Hydrates the auth session from the HttpOnly cookie on mount.
 * Wrap the app shell with this provider.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const refresh = useAuthStore((s) => s.refresh);
  const hasRefreshed = React.useRef(false);

  React.useEffect(() => {
    if (!hasRefreshed.current) {
      hasRefreshed.current = true;
      refresh();
    }
  }, [refresh]);

  return <>{children}</>;
}
