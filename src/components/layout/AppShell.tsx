import * as React from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { PersistenceNotice } from "./PersistenceNotice";
import { ConflictBanner } from "./ConflictBanner";
import { AuthProvider } from "./AuthProvider";
import { AiConfigProvider } from "@/components/ai/AiConfigProvider";
import { ToastProvider } from "@/components/ui/Toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AiConfigProvider>
        <ToastProvider>
          <div className="flex min-h-dvh">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <MobileNav />
              <main className="flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
                <div className="mx-auto w-full max-w-7xl">
                  <PersistenceNotice />
                  <ConflictBanner />
                  {children}
                </div>
              </main>
            </div>
          </div>
        </ToastProvider>
      </AiConfigProvider>
    </AuthProvider>
  );
}
