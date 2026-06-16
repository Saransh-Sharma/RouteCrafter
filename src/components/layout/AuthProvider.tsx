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
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const refresh = useAuthStore((s) => s.refresh);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useProjectsStore((s) => s.hasHydrated);
  const hydrateCloudProjects = useProjectsStore((s) => s.hydrateCloudProjects);
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

  return <>{children}</>;
}
