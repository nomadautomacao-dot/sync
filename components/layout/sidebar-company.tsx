"use client";

import { ChevronDown, ChevronRight, LayoutGrid, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import type { Company } from "@/core/domain/organization";
import { cn } from "@/core/lib/utils";
import { useSidebarStore } from "@/core/stores/sidebar-store";
import { useWorkspaceStore } from "@/core/stores/workspace-store";

interface SidebarCompanyProps {
  company: Company;
  collapsed?: boolean;
}

export function SidebarCompany({ company, collapsed }: SidebarCompanyProps) {
  const pathname = usePathname();
  const { expandedCompanies, toggleCompany } = useSidebarStore();
  const { setActiveCompany } = useWorkspaceStore();
  const isExpanded = expandedCompanies.includes(company.id);
  const isCompanyRoute = pathname.startsWith(`/companies/${company.id}`);

  if (collapsed) {
    return (
      <Link
        href={`/companies/${company.id}`}
        title={company.tradingName}
        onClick={() => setActiveCompany(company.id)}
        className="flex h-9 items-center justify-center rounded-md px-2 text-neutral-300 hover:bg-neutral-800 hover:text-white"
      >
        <CompanyAvatar name={company.tradingName} />
      </Link>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => toggleCompany(company.id)}
          className="rounded-sm p-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          aria-label={`Alternar ${company.tradingName}`}
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <Link
          href={`/companies/${company.id}`}
          onClick={() => setActiveCompany(company.id)}
          className={cn(
            "flex h-10 flex-1 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors",
            isCompanyRoute
              ? "bg-neutral-800 text-white"
              : "text-neutral-300 hover:bg-neutral-800 hover:text-white",
          )}
        >
          <CompanyAvatar name={company.tradingName} />
          <span className="truncate">{company.tradingName}</span>
        </Link>
      </div>
      {isExpanded ? (
        <div className="ml-7 space-y-0.5 border-l border-neutral-800 pl-2">
          <Link
            href={`/companies/${company.id}`}
            className="flex h-7 items-center gap-2 rounded-md px-2 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <Users className="h-3.5 w-3.5" />
            Funcionarios
          </Link>
          <Link
            href="/modules"
            className="flex h-7 items-center gap-2 rounded-md px-2 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Modulos
          </Link>
        </div>
      ) : null}
    </div>
  );
}
