"use client";

import * as React from "react";
import { requestAiConfig } from "@/lib/ai/client";
import type { AiServerConfig } from "@/lib/ai/types";

interface AiConfigContextValue {
  config: AiServerConfig | null;
  loading: boolean;
}

const AiConfigContext = React.createContext<AiConfigContextValue>({
  config: null,
  loading: true,
});

export function AiConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<AiServerConfig | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    requestAiConfig()
      .then((next) => {
        if (active) setConfig(next);
      })
      .catch(() => {
        if (active) setConfig(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AiConfigContext.Provider value={{ config, loading }}>
      {children}
    </AiConfigContext.Provider>
  );
}

export function useAiConfig(): AiConfigContextValue {
  return React.useContext(AiConfigContext);
}
