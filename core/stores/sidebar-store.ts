"use client";

import { create } from "zustand";

interface SidebarStore {
  isCollapsed: boolean;
  expandedCompanies: string[];
  toggleCollapse: () => void;
  toggleCompany: (companyId: string) => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isCollapsed: false,
  expandedCompanies: [],
  toggleCollapse: () =>
    set((state) => ({
      isCollapsed: !state.isCollapsed,
    })),
  toggleCompany: (companyId) =>
    set((state) => {
      const exists = state.expandedCompanies.includes(companyId);
      return {
        expandedCompanies: exists
          ? state.expandedCompanies.filter((id) => id !== companyId)
          : [...state.expandedCompanies, companyId],
      };
    }),
}));
