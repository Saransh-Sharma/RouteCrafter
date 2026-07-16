import * as React from "react";
import { TopBar } from "./TopBar";
import { PersistenceNotice } from "./PersistenceNotice";
import { ConflictBanner } from "./ConflictBanner";
import { AuthProvider } from "./AuthProvider";
import { AiConfigProvider } from "@/components/ai/AiConfigProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { CommandPalette } from "./CommandPalette";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AiConfigProvider>
        <ToastProvider>
          <div className="flex min-h-dvh flex-col">
            <TopBar />
            <main className="flex-1 px-5 py-8 sm:px-8 lg:py-10">
              <div className="mx-auto w-full max-w-7xl">
                <PersistenceNotice />
                <ConflictBanner />
                {children}
              </div>
            </main>
          </div>
          <CommandPalette />
        </ToastProvider>
      </AiConfigProvider>
    </AuthProvider>
  );
}
