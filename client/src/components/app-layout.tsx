import { type ReactNode } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center border-b px-4">
          <SidebarTrigger className="-ml-1" data-testid="sidebar-trigger" />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
        <PerplexityAttribution />
      </SidebarInset>
    </SidebarProvider>
  );
}
