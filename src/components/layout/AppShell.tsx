import * as React from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { PersistenceNotice } from "./PersistenceNotice";
import { AuthProvider } from "./AuthProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav />
          <main className="flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
            <div className="mx-auto w-full max-w-6xl">
              <PersistenceNotice />
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
