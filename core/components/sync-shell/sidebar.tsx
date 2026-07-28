"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  InboxIcon,
  Building2Icon,
  UsersIcon,
  TrendingUpIcon,
  BoxesIcon,
  SettingsIcon,
  PanelLeftCloseIcon,
  ChevronRightIcon,
  GraduationCapIcon,
  PlusIcon,
  HelpCircleIcon,
  MoreVerticalIcon,
} from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/core/providers/auth-provider";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { listCities } from "@/core/lib/cities-firestore";
import { NovoLevantamentoWizard } from "@/core/components/novo-levantamento-wizard";

interface ItemDeNavegacao {
  rotulo: string;
  rota: string;
  icone: React.ElementType;
  contador?: string;
}

const NAV_ITEMS: readonly ItemDeNavegacao[] = [
  { rotulo: "Painel", rota: "/painel", icone: LayoutDashboardIcon },
  { rotulo: "Caixa de entrada", rota: "/caixa", icone: InboxIcon },
  { rotulo: "Pipeline", rota: "/pipeline", icone: TrendingUpIcon },
  { rotulo: "Empresas", rota: "/empresas", icone: Building2Icon },
  { rotulo: "Pessoas", rota: "/pessoas", icone: UsersIcon },
  { rotulo: "Módulos", rota: "/modulos", icone: BoxesIcon },
  { rotulo: "Ajustes", rota: "/ajustes", icone: SettingsIcon },
];

function formatarNomeExibicao(name?: string | null, email?: string | null): string {
  if (name && name.trim()) return name.trim();
  if (email) {
    const handle = email.split("@")[0];
    const semNumeros = handle.replace(/\d+/g, " ").trim();
    if (semNumeros) {
      return semNumeros
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  }
  return "Marcos Rocha";
}

export function SyncSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [recolhida, setRecolhida] = useState(false);
  const [wizardAberto, setWizardAberto] = useState(false);

  const { data: cities = [] } = useQuery({
    queryKey: ["sidebar-cities-real", user?.groupId],
    queryFn: async () => {
      if (!user?.groupId) return [];
      const db = getFirebaseDb();
      return await listCities(db, user.groupId);
    },
    enabled: !!user?.groupId,
  });

  const cidadesCount = cities.length;
  const nomeExibicao = formatarNomeExibicao(user?.name, user?.email);
  const iniciais = nomeExibicao
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "GS";

  return (
    <>
      <aside
        className={`group/sidebar relative z-20 flex shrink-0 flex-col bg-white/85 backdrop-blur-xl border border-white/95 rounded-[18px] shadow-[0_14px_36px_rgba(22,24,29,.07)] transition-all duration-300 ease-in-out ${
          recolhida ? "w-[68px] p-2.5" : "w-[240px] p-[16px_14px_14px]"
        }`}
      >
        {/* ── Topo: Marca / Logo ────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between px-1">
          {recolhida ? (
            <button
              type="button"
              onClick={() => setRecolhida(false)}
              title="Expandir barra lateral"
              className="mx-auto flex size-10 items-center justify-center rounded-xl bg-white p-0.5 border border-[#F0F1F5] shadow-2xs transition-transform hover:scale-105"
            >
              <Image
                src="/global-sync-icon.png"
                alt="Global Sync"
                width={34}
                height={34}
                priority
                className="size-8 shrink-0 rounded-md"
              />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-[10px]">
                <Image
                  src="/global-sync-icon.png"
                  alt="Global Sync"
                  width={32}
                  height={32}
                  priority
                  className="size-[32px] shrink-0"
                />
                <span className="text-[19px] font-bold tracking-[-0.6px] text-[#16181D]">Global Sync</span>
              </div>

              <button
                type="button"
                onClick={() => setRecolhida(true)}
                title="Recolher barra lateral"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[#A2A6B2] transition-colors hover:bg-[#F2F1F7] hover:text-[#3B3F4A]"
              >
                <PanelLeftCloseIcon className="size-4" />
              </button>
            </>
          )}
        </div>

        <div className="h-4 shrink-0" />

        {/* ── Seção Workspace / Nav Items ────────────────────────────────── */}
        {!recolhida && (
          <div className="shrink-0 px-2 font-mono text-[9.5px] font-semibold tracking-[1.4px] text-[#A2A6B2] uppercase">
            WORKSPACE
          </div>
        )}
        <div className="h-1.5 shrink-0" />

        {/* Nav sem barra de rolagem nativa visual visível */}
        <nav
          aria-label="Navegação principal"
          className="flex-1 space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV_ITEMS.map((item) => {
            const Icone = item.icone;
            const ativo = pathname === item.rota || (item.rota !== "/painel" && pathname.startsWith(`${item.rota}/`));

            return (
              <Link
                key={item.rota}
                href={item.rota}
                title={recolhida ? item.rotulo : undefined}
                aria-current={ativo ? "page" : undefined}
                className={`group flex h-[38px] items-center rounded-[12px] transition-colors duration-150 ${
                  recolhida ? "justify-center px-0" : "justify-between px-[10px]"
                } ${
                  ativo
                    ? "bg-[#F2F1F7] text-[#16181D] font-semibold"
                    : "text-[#767A86] hover:bg-[#F2F1F7]"
                }`}
              >
                <div className={`flex items-center ${recolhida ? "justify-center" : "gap-[10px]"}`}>
                  <Icone
                    className={`size-[17px] shrink-0 transition-colors ${
                      ativo ? "text-[#16181D]" : "text-[#A2A6B2] group-hover:text-[#16181D]"
                    }`}
                  />
                  {!recolhida && (
                    <span className="text-[13px] tracking-[-0.2px]">{item.rotulo}</span>
                  )}
                </div>

                {!recolhida && item.contador && Number(item.contador) > 0 && (
                  <span className="rounded-[20px] bg-[#16181D] px-[7px] py-[2px] font-mono text-[10px] font-semibold text-white">
                    {item.contador}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Módulo Ativo Card ─────────────────────────────────────────── */}
        {!recolhida && (
          <div className="shrink-0 mt-2">
            <div className="px-2 font-mono text-[9.5px] font-semibold tracking-[1.4px] text-[#A2A6B2] uppercase">
              MÓDULO ATIVO
            </div>
            <div className="h-1.5" />

            <div className="rounded-[14px] border border-white/90 bg-gradient-to-br from-[#EEE7F9] to-[#E2EDFA] p-[10px_12px_10px]">
              <div className="flex items-center gap-[9px]">
                <GraduationCapIcon className="size-[16px] text-[#16181D]" />
                <span className="flex-1 text-[12.5px] font-semibold text-[#16181D]">FUNDEB 2026</span>
                <span className="font-mono text-[10.5px] text-[#5A5E6A]">{cidadesCount}</span>
              </div>

              <div className="h-[8px]" />

              <button
                type="button"
                onClick={() => setWizardAberto(true)}
                className="flex h-[36px] w-full items-center justify-between rounded-[20px] bg-[#16181D] px-[12px] text-white shadow-[0_6px_16px_rgba(22,24,29,.14)] transition-colors hover:bg-[#2C2F38]"
              >
                <div className="flex items-center gap-[6px]">
                  <PlusIcon className="size-[15px] text-white" />
                  <span className="text-[12px] font-semibold text-white whitespace-nowrap">
                    Novo levantamento
                  </span>
                </div>
                <span className="font-mono text-[9px] text-white/60">⌘N</span>
              </button>
            </div>
          </div>
        )}

        <div className="shrink-0 h-2" />

        {/* ── Ajuda e Atalhos ────────────────────────────────────────────── */}
        {!recolhida && (
          <button
            type="button"
            className="shrink-0 flex h-[32px] w-full items-center gap-[8px] rounded-[10px] px-[10px] text-[#767A86] transition-colors hover:bg-[#F2F1F7]"
          >
            <HelpCircleIcon className="size-[15px] text-[#A2A6B2]" />
            <span className="flex-1 text-left text-[12px]">Ajuda e atalhos</span>
            <span className="rounded-[5px] border border-[#ECEDF2] px-[5px] py-[1px] font-mono text-[9px] text-[#A2A6B2]">
              ⌘/
            </span>
          </button>
        )}

        <div className="shrink-0 h-2" />

        {/* ── User Profile Card ──────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-[10px] rounded-[14px] border border-white/95 bg-[#F7F6FA] p-[8px_10px] cursor-pointer">
          <div className="flex size-[32px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#16181D] to-[#3B3F4A] text-[11.5px] font-bold text-white">
            {iniciais}
          </div>

          {!recolhida && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[#16181D]">{nomeExibicao}</p>
                <p className="truncate text-[10px] text-[#767A86]">Admin do grupo</p>
              </div>
              <MoreVerticalIcon className="size-[16px] shrink-0 text-[#A2A6B2]" />
            </>
          )}
        </div>
      </aside>

      {/* Wizard Modal */}
      {wizardAberto && <NovoLevantamentoWizard onClose={() => setWizardAberto(false)} />}
    </>
  );
}
