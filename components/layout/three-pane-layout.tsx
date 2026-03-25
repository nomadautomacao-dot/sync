"use client";

import type { ReactNode } from "react";
import { ContextPanel } from "@/components/layout/context-panel";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/shared/command-palette";
import { useWorkspaceStore } from "@/core/stores/workspace-store";

interface ThreePaneLayoutProps {
  children: ReactNode;
}

export function ThreePaneLayout({ children }: ThreePaneLayoutProps) {
  const { isContextPanelOpen } = useWorkspaceStore();

  return (
    <div className="flex h-screen w-full bg-neutral-950 text-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      {isContextPanelOpen ? <ContextPanel /> : null}
      <CommandPalette />
    </div>
  );
}
