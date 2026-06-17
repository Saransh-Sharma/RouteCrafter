"use client";

import * as React from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useAiSettingsStore } from "@/lib/store/ai-settings-store";
import { isCloudPersistenceEnabled } from "@/lib/persistence/config";

/**
 * Hydrates the auth session from the HttpOnly cookie on mount.
 * Wrap the app shell with this provider.
 */
const CLOUD_POLL_INTERVAL_MS = 20_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const refresh = useAuthStore((s) => s.refresh);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useProjectsStore((s) => s.hasHydrated);
  const hydrateCloudProjects = useProjectsStore((s) => s.hydrateCloudProjects);
  const refreshFromCloud = useProjectsStore((s) => s.refreshFromCloud);
  const hydrateCloudPreferences = useAiSettingsStore(
    (s) => s.hydrateCloudPreferences,
  );
  const hasRefreshed = React.useRef(false);
  const hydratedUserRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!hasRefreshed.current) {
      hasRefreshed.current = true;
      refresh();
    }
  }, [refresh]);

  React.useEffect(() => {
    if (
      !isCloudPersistenceEnabled() ||
      !hasHydrated ||
      !user ||
      hydratedUserRef.current === user.id
    ) {
      return;
    }
    hydratedUserRef.current = user.id;
    void hydrateCloudProjects();
    void hydrateCloudPreferences();
  }, [hasHydrated, hydrateCloudPreferences, hydrateCloudProjects, user]);

  // Cross-user freshness: the shared workspace is authoritative in the cloud, so
  // refetch on tab focus/visibility and on a light interval while the tab is visible.
  // Overlap between a slow refresh and the next tick is guarded inside
  // `refreshFromCloud` (a module-level in-flight flag), so these triggers can fire
  // freely without stacking requests.
  React.useEffect(() => {
    if (!isCloudPersistenceEnabled() || !hasHydrated || !user) return;

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshFromCloud();
      }
    };

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    const interval = window.setInterval(
      refreshIfVisible,
      CLOUD_POLL_INTERVAL_MS,
    );

    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.clearInterval(interval);
    };
  }, [hasHydrated, refreshFromCloud, user]);

  return <>{children}</>;
}
