"use client";

import { Bell, ChevronsLeftRight, LayoutGrid, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebarStore } from "@/core/stores/sidebar-store";
import { useWorkspaceStore } from "@/core/stores/workspace-store";

const breadcrumbMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inbox": "Inbox",
  "/companies": "Empresas",
  "/people": "Pessoas",
  "/modules": "Modulos",
  "/settings": "Configuracoes",
};

function titleFromPath(pathname: string) {
  if (pathname.startsWith("/companies/")) {
    return "Empresa";
  }

  return breadcrumbMap[pathname] ?? "Workspace";
}

export function Header() {
  const pathname = usePathname();
  const { toggleCollapse } = useSidebarStore();
  const { toggleContextPanel } = useWorkspaceStore();
  const { data: session } = useSession();
  const current = useMemo(() => titleFromPath(pathname), [pathname]);
  const userInitial = useMemo(
    () => (session?.user?.name?.trim()?.[0] ?? session?.user?.email?.[0] ?? "U").toUpperCase(),
    [session],
  );

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-neutral-800 px-8">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          onClick={toggleCollapse}
          aria-label="Alternar sidebar"
        >
          <ChevronsLeftRight className="h-4 w-4" />
        </Button>
        <div className="space-y-0.5">
          <p className="text-xs uppercase tracking-wider text-neutral-500">
            Workspace
          </p>
          <h2 className="text-sm font-semibold text-white">{current}</h2>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="relative hidden w-full max-w-sm md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            placeholder="Buscar..."
            className="h-10 border-neutral-800 bg-neutral-900 pl-9 text-sm text-white placeholder:text-neutral-500"
            aria-label="Buscar no workspace"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          <Bell className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          onClick={toggleContextPanel}
          aria-label="Alternar painel de contexto"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Avatar className="h-9 w-9 border border-neutral-700 bg-neutral-800">
          <AvatarImage
            src={session?.user?.image ?? undefined}
            alt={session?.user?.name ?? "Usuario"}
            referrerPolicy="no-referrer"
          />
          <AvatarFallback className="bg-neutral-800 text-sm font-semibold text-white">
            {userInitial}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
