"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  SearchIcon,
  BellIcon,
  AlertTriangleIcon,
  FileCheck2Icon,
  AlertCircleIcon,
  FileTextIcon,
  CloudCheckIcon,
  CheckIcon,
} from "lucide-react";

import { User } from "@/core/lib/types";

interface SyncHeaderProps {
  user: User;
}

const TITULOS_DAS_ROTAS: Record<string, string> = {
  "/painel": "Painel",
  "/pipeline": "Pipeline",
  "/modulos": "Módulos",
  "/empresas": "Empresas",
  "/pessoas": "Pessoas",
  "/caixa": "Caixa de entrada",
  "/ajustes": "Ajustes",
};

interface Notificacao {
  id: string;
  titulo: string;
  meta: string;
  icone: React.ElementType;
  iconeFundo: string;
  iconeCor: string;
  naoLida: boolean;
}

export function SyncHeader({ user }: SyncHeaderProps) {
  const pathname = usePathname();
  const [notifAberto, setNotifAberto] = useState(false);
  const [notifs, setNotifs] = useState<Notificacao[]>([
    {
      id: "1",
      titulo: "Levantamento Cristalina aguarda sua revisão",
      meta: "FUNDEB · lote 2026-07 · 09:14",
      icone: FileCheck2Icon,
      iconeFundo: "#FBF0D9",
      iconeCor: "#8A5A00",
      naoLida: true,
    },
    {
      id: "2",
      titulo: "Contrato Cristalina vence em 12 dias",
      meta: "renovação não iniciada · 08:40",
      icone: AlertCircleIcon,
      iconeFundo: "#FBE9EE",
      iconeCor: "#8A3A50",
      naoLida: true,
    },
    {
      id: "3",
      titulo: "Proposta aprovada pelo gestor",
      meta: "Senador José Porfírio · PA · ontem",
      icone: FileTextIcon,
      iconeFundo: "#E2EDFA",
      iconeCor: "#2C4E82",
      naoLida: true,
    },
    {
      id: "4",
      titulo: "Base FNDE atualizada sem divergência",
      meta: "VAAT 2026 · 5.570 municípios · 06:10",
      icone: CloudCheckIcon,
      iconeFundo: "#E4F4EC",
      iconeCor: "#1F6A47",
      naoLida: true,
    },
  ]);

  const rotaCorrespondente = Object.keys(TITULOS_DAS_ROTAS).find(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
  const tituloDaPagina = rotaCorrespondente ? TITULOS_DAS_ROTAS[rotaCorrespondente] : "Painel";

  const naoLidasCount = notifs.filter((n) => n.naoLida).length;

  const marcarTodasLidas = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, naoLida: false })));
  };

  const marcarComoLida = (id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, naoLida: false } : n)));
  };

  return (
    <header className="relative z-40 flex h-[60px] shrink-0 items-center justify-between gap-[12px] rounded-[18px] border border-white/95 bg-white/85 px-[18px] shadow-[0_10px_26px_rgba(22,24,29,.06)] backdrop-blur-xl">
      {/* ── Esquerda: Overline WORKSPACE + Título ─────────────────────── */}
      <div className="whitespace-nowrap">
        <div className="font-mono text-[9px] font-semibold tracking-[1.3px] text-[#A2A6B2]">
          WORKSPACE
        </div>
        <h1 className="mt-[1px] text-[15px] font-bold tracking-[-0.35px] text-[#16181D]">
          {tituloDaPagina}
        </h1>
      </div>

      <div className="flex-1" />

      {/* ── Centro: Barra de Busca Pill ───────────────────────────────── */}
      <div className="flex h-[38px] w-[280px] cursor-text items-center gap-[9px] rounded-[22px] border border-white/90 bg-[#F2F1F7] px-[14px]">
        <SearchIcon className="size-[16px] text-[#A2A6B2]" />
        <span className="flex-1 truncate text-[13px] text-[#A2A6B2]">
          Buscar município, empresa…
        </span>
        <span className="rounded-[5px] bg-white px-[6px] py-[1px] font-mono text-[10px] text-[#767A86]">
          ⌘K
        </span>
      </div>

      {/* ── Status Badge: Atraso SICONFI ──────────────────────────────── */}
      <div className="flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[20px] bg-[#FBF0D9] px-[12px] py-[6px] font-mono text-[10.5px] font-semibold text-[#8A5A00]">
        <AlertTriangleIcon className="size-[14px]" />
        SICONFI · atraso 2d
      </div>

      {/* ── Botão e Dropdown de Notificações ───────────────────────────── */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setNotifAberto(!notifAberto)}
          className={`relative flex size-[36px] items-center justify-center rounded-full transition-colors ${
            notifAberto ? "bg-[#ECEBF2]" : "bg-[#F2F1F7] hover:bg-[#ECEBF2]"
          }`}
          title="Notificações"
        >
          <BellIcon className="size-[18px] text-[#3B3F4A]" />
          {naoLidasCount > 0 && (
            <span className="absolute right-[5px] top-[5px] flex h-[15px] min-w-[15px] items-center justify-center rounded-[8px] border-[1.5px] border-white bg-[#16181D] px-[3px] font-mono text-[8.5px] font-semibold text-white">
              {naoLidasCount}
            </span>
          )}
        </button>

        {notifAberto && (
          <div className="absolute right-0 top-[46px] z-50 w-[360px] overflow-hidden rounded-[18px] border border-white bg-white/97 shadow-[0_24px_60px_rgba(22,24,29,.18)] backdrop-blur-[14px]">
            {/* Header do Popover */}
            <div className="flex items-center justify-between p-[14px_16px_10px]">
              <span className="text-[14px] font-bold tracking-[-0.3px] text-[#16181D]">
                Notificações
              </span>
              <button
                type="button"
                onClick={marcarTodasLidas}
                className="text-[11.5px] font-semibold text-[#767A86] transition-colors hover:text-[#16181D]"
              >
                Marcar todas como lidas
              </button>
            </div>

            {/* Lista de Notificações */}
            <div>
              {notifs.map((n) => {
                const Icone = n.icone;
                return (
                  <div
                    key={n.id}
                    onClick={() => marcarComoLida(n.id)}
                    className={`flex items-start gap-[11px] border-t border-[#F4F5F8] p-[11px_16px] cursor-pointer transition-all hover:bg-[#F7F6FA] ${
                      n.naoLida ? "opacity-100" : "opacity-55"
                    }`}
                  >
                    <div
                      className="flex size-[30px] shrink-0 items-center justify-center rounded-[10px]"
                      style={{ backgroundColor: n.iconeFundo }}
                    >
                      <Icone className="size-[15px]" style={{ color: n.iconeCor }} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold leading-[1.35] text-[#16181D]">
                        {n.titulo}
                      </p>
                      <p className="mt-[2px] font-mono text-[10px] text-[#767A86]">{n.meta}</p>
                    </div>

                    {n.naoLida && (
                      <span className="mt-[5px] size-[7px] shrink-0 rounded-full bg-[#F5A3B5]" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer do Popover */}
            <div className="flex items-center justify-between border-t border-[#F0F1F5] bg-[#F7F6FA] p-[10px_16px]">
              <div className="flex items-center gap-[6px] font-mono text-[9.5px] text-[#767A86]">
                <span className="size-[5px] animate-pulse rounded-full bg-[#34C388]" />
                sincronizado hoje 14:32
              </div>
              <Link
                href="/caixa"
                onClick={() => setNotifAberto(false)}
                className="text-[11.5px] font-semibold text-[#16181D] hover:underline"
              >
                Ver caixa de entrada →
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
