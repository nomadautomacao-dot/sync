"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MenuIcon } from "lucide-react";

import { SyncHeader } from "@/core/components/sync-shell/header";
import { SyncSidebar } from "@/core/components/sync-shell/sidebar";
import { useAuth } from "@/core/providers/auth-provider";
import { FilaEmissaoProvider } from "@/core/providers/fila-emissao-provider";

interface SyncLayoutProps {
  children: ReactNode;
}

/**
 * A barra de cima ficou só no painel.
 *
 * Nas telas de trabalho ela repetia o título que a página já dá e gastava 74px
 * de altura (60 da barra + 14 do respiro) — numa tabela isso é uma linha e meia
 * de município. No painel ela continua fazendo sentido: é lá que a busca
 * global, o estado da carteira e os alertas têm onde morar.
 */
const ROTAS_COM_BARRA = ["/painel"];

export default function SyncLayout({ children }: SyncLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [sidebarMobileAberta, setSidebarMobileAberta] = useState(false);
  const comBarra = ROTAS_COM_BARRA.includes(pathname);

  useEffect(() => {
    if (!loading && !user) router.replace("/entrar");
  }, [loading, user, router]);

  if (loading || !user) return <EsqueletoDoShell />;

  return (
    <FilaEmissaoProvider>
    <div className="relative flex h-dvh w-full gap-2 overflow-hidden p-2 font-sans md:gap-[14px] md:p-[14px]">
      {/* ── Ambient background glows (Console Soft) ───────────────────────── */}
      <div className="pointer-events-none absolute -right-[240px] -top-[60px] h-[300px] w-[560px] bg-[radial-gradient(ellipse,_rgba(255,255,255,0.95),_transparent_65%)]" />
      <div className="pointer-events-none absolute -left-[140px] bottom-[120px] h-[20px] w-[460px] bg-[linear-gradient(90deg,_transparent,_rgba(245,163,181,0.5),_rgba(247,199,126,0.5),_transparent)] blur-[24px]" />

      <SyncSidebar
        abertaNoMobile={sidebarMobileAberta}
        aoFecharNoMobile={() => setSidebarMobileAberta(false)}
      />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-2 overflow-hidden md:gap-[14px]">
        {comBarra ? (
          <SyncHeader
            sidebarMobileAberta={sidebarMobileAberta}
            aoAbrirSidebarMobile={() => setSidebarMobileAberta(true)}
          />
        ) : (
          // Sem a barra, o celular perderia o único caminho para a navegação —
          // no desktop a lateral está sempre visível e este botão não aparece.
          <button
            type="button"
            onClick={() => setSidebarMobileAberta(true)}
            aria-label="Abrir navegação"
            aria-controls="sync-sidebar"
            aria-expanded={sidebarMobileAberta}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/95 bg-white/90 text-[#3B3F4A] shadow-[0_10px_26px_rgba(22,24,29,.06)] backdrop-blur-xl transition-colors hover:bg-white md:hidden"
          >
            <MenuIcon className="size-[18px]" />
          </button>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
    </FilaEmissaoProvider>
  );
}

function EsqueletoDoShell() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-dvh w-full animate-pulse gap-2 bg-transparent p-2 font-sans md:gap-[14px] md:p-[14px]"
    >
      <span className="sr-only">Carregando sua sessão…</span>
      <div className="hidden w-[240px] shrink-0 rounded-[18px] border border-white/95 bg-white/85 backdrop-blur-xl md:block" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:gap-[14px]">
        <div className="h-14 shrink-0 rounded-[18px] bg-white/85 backdrop-blur-xl border border-white/95" />
        <div className="flex-1">
          <div className="h-7 w-52 rounded-control bg-[#ECEBF2]" />
          <div className="mt-6 h-40 w-full rounded-card border border-[#F0F1F5] bg-white" />
        </div>
      </div>
    </div>
  );
}
