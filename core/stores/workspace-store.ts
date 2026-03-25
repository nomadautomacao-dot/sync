"use client";

import { create } from "zustand";
import type { ModuleKey } from "@/core/domain/module";

interface WorkspaceStore {
  isContextPanelOpen: boolean;
  activeCompanyId?: string;
  activeModuleKey?: ModuleKey;
  toggleContextPanel: () => void;
  setActiveCompany: (companyId?: string) => void;
  setActiveModule: (moduleKey?: ModuleKey) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  isContextPanelOpen: false,
  activeCompanyId: undefined,
  activeModuleKey: undefined,
  toggleContextPanel: () =>
    set((state) => ({
      isContextPanelOpen: !state.isContextPanelOpen,
    })),
  setActiveCompany: (companyId) => set({ activeCompanyId: companyId }),
  setActiveModule: (moduleKey) => set({ activeModuleKey: moduleKey }),
}));
