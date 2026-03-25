"use client";

import { LogOut, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { signOut, useSession } from "next-auth/react";
import { workspaceNavigation } from "@/core/config/navigation";
import { useCompanies } from "@/core/hooks/use-companies";
import { useSidebarStore } from "@/core/stores/sidebar-store";
import { Button } from "@/components/ui/button";
import { SidebarCompany } from "@/components/layout/sidebar-company";
import { SidebarItem } from "@/components/layout/sidebar-item";

export function Sidebar() {
  const { isCollapsed } = useSidebarStore();
  const { data: companies = [] } = useCompanies();
  const { data: session } = useSession();

  const widthClass = useMemo(() => (isCollapsed ? "w-[72px]" : "w-64"), [isCollapsed]);
  const accountName = session?.user?.name?.trim() || "Conta";
  const accountEmail = session?.user?.email?.trim() || "";

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <aside
      className={`${widthClass} flex h-screen shrink-0 flex-col border-r border-neutral-800 bg-neutral-900 px-6 py-5 transition-[width] duration-200`}
    >
      <div className="mb-5 flex min-h-[56px] items-center justify-center">
        {isCollapsed ? (
          <Image
            src="/sync-mark.svg"
            alt="Sync"
            unoptimized
            width={32}
            height={32}
            className="mx-auto h-8 w-8 rounded-md"
          />
        ) : (
          <Image
            src="/sync-logo.svg"
            alt="Sync"
            unoptimized
            loading="eager"
            width={200}
            height={48}
            className="mx-auto h-10 w-auto object-contain"
          />
        )}
      </div>

      {!isCollapsed ? (
        <p className="mb-2 px-3 text-xs font-semibold text-neutral-500">
          Workspace
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        {workspaceNavigation
          .filter((item) => item.href !== "/settings")
          .map((item) => (
            <SidebarItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={isCollapsed}
            />
          ))}
      </div>

      <div className="mt-4 border-t border-neutral-800 pt-4">
        {workspaceNavigation
          .filter((item) => item.href === "/settings")
          .map((item) => (
            <SidebarItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={isCollapsed}
            />
          ))}
      </div>

      <div className="mt-8 flex-1 overflow-y-auto">
        {!isCollapsed ? (
          <div className="mb-3 flex items-center justify-between px-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Empresas
            </p>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400 hover:bg-neutral-800" asChild>
              <Link href="/companies/new">
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}
        <div className="space-y-1">
          {companies.map((company) => (
            <SidebarCompany key={company.id} company={company} collapsed={isCollapsed} />
          ))}
        </div>
      </div>

      <div className="mt-3 border-t border-neutral-800 pt-3">
        <div className="flex min-h-9 items-center rounded-md px-2.5 py-1 text-neutral-300 hover:bg-neutral-800 hover:text-white">
          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {accountName}
              </p>
              {accountEmail ? (
                <p className="truncate text-[11px] text-neutral-500">{accountEmail}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        {!isCollapsed ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-8 w-full justify-start gap-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
