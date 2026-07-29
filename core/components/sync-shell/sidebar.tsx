"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  InboxIcon,
  Building2Icon,
  UsersIcon,
  TrendingUpIcon,
  MapPinnedIcon,
  BoxesIcon,
  FolderArchiveIcon,
  SettingsIcon,
  PanelLeftCloseIcon,
  ChevronRightIcon,
  CheckIcon,
  AlertCircleIcon,
  HelpCircleIcon,
  XIcon,
} from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/core/providers/auth-provider";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { listCities } from "@/core/lib/cities-firestore";

interface ItemDeNavegacao {
  rotulo: string;
  rota: string;
  icone: React.ElementType;
  contador?: string;
}

interface SyncSidebarProps {
  abertaNoMobile: boolean;
  aoFecharNoMobile: () => void;
}

const NAV_ITEMS: readonly ItemDeNavegacao[] = [
  { rotulo: "Painel", rota: "/painel", icone: LayoutDashboardIcon },
  { rotulo: "Caixa de entrada", rota: "/caixa", icone: InboxIcon },
  { rotulo: "Pipeline", rota: "/pipeline", icone: TrendingUpIcon },
  { rotulo: "Empresas", rota: "/empresas", icone: Building2Icon },
  { rotulo: "Pessoas", rota: "/pessoas", icone: UsersIcon },
  { rotulo: "Documentos", rota: "/documentos", icone: FolderArchiveIcon },
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

export function SyncSidebar({ abertaNoMobile, aoFecharNoMobile }: SyncSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [recolhida, setRecolhida] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);

  const {
    data: cities = [],
    isPending: cidadesCarregando,
    isError: cidadesComErro,
    isFetching: cidadesAtualizando,
    refetch: recarregarCidades,
  } = useQuery({
    queryKey: ["sidebar-cities-real", user?.groupId],
    queryFn: async () => {
      if (!user?.groupId) return [];
      const db = getFirebaseDb();
      return await listCities(db, user.groupId);
    },
    enabled: !!user?.groupId,
  });

  useEffect(() => {
    const abrirAjudaPorAtalho = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAjudaAberta(false);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        event.preventDefault();
        setAjudaAberta((aberta) => !aberta);
      }
    };

    window.addEventListener("keydown", abrirAjudaPorAtalho);
    return () => window.removeEventListener("keydown", abrirAjudaPorAtalho);
  }, []);

  const compacta = recolhida && !abertaNoMobile;
  const cidadesAtivas = pathname === "/cidades" || pathname.startsWith("/cidades/");
  const consultaCidadesPendente = Boolean(user?.groupId) && cidadesCarregando;
  const cidadesCount = cities.length;
  const cidadesCountLabel = `${cidadesCount} ${cidadesCount === 1 ? "cidade" : "cidades"}`;
  const fecharNavegacaoMobile = () => {
    aoFecharNoMobile();
    setAjudaAberta(false);
  };
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
      {abertaNoMobile && (
        <button
          type="button"
          aria-label="Fechar navegação"
          onClick={fecharNavegacaoMobile}
          className="fixed inset-0 z-50 bg-[#16181D]/20 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside
        id="sync-sidebar"
        aria-label="Barra lateral"
        className={`group/sidebar fixed inset-y-2 left-2 z-[60] flex min-h-0 w-[min(260px,calc(100vw-16px))] shrink-0 flex-col overflow-hidden rounded-[18px] border border-white/95 bg-white/90 p-[16px_14px_14px] shadow-[0_14px_36px_rgba(22,24,29,.12)] backdrop-blur-xl transition-[width,transform] duration-300 ease-out md:relative md:inset-auto md:z-20 md:translate-x-0 md:bg-white/85 md:shadow-[0_14px_36px_rgba(22,24,29,.07)] ${
          abertaNoMobile ? "translate-x-0" : "-translate-x-[calc(100%+16px)]"
        } ${
          compacta ? "md:w-[68px] md:p-2.5" : "md:w-[240px] md:p-[16px_14px_14px]"
        }`}
      >
        {/* ── Topo: Marca / Logo ────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between px-1">
          {compacta ? (
            <button
              type="button"
              onClick={() => setRecolhida(false)}
              aria-label="Expandir barra lateral"
              className="mx-auto flex size-10 items-center justify-center rounded-xl border border-[#F0F1F5] bg-white p-0.5 shadow-2xs transition-transform hover:scale-105"
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
                onClick={() => {
                  aoFecharNoMobile();
                  setRecolhida(true);
                }}
                aria-label="Recolher barra lateral"
                className="hidden size-9 shrink-0 items-center justify-center rounded-xl text-[#A2A6B2] transition-colors hover:bg-[#F2F1F7] hover:text-[#3B3F4A] md:flex"
              >
                <PanelLeftCloseIcon className="size-4" />
              </button>

              <button
                type="button"
                onClick={fecharNavegacaoMobile}
                aria-label="Fechar navegação"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[#767A86] transition-colors hover:bg-[#F2F1F7] hover:text-[#16181D] md:hidden"
              >
                <XIcon className="size-[18px]" />
              </button>
            </>
          )}
        </div>

        <div className="h-4 shrink-0" />

        {/* ── Seção Workspace / Nav Items ────────────────────────────────── */}
        {!compacta && (
          <div className="shrink-0 px-2 font-mono text-[9.5px] font-semibold tracking-[1.4px] text-[#A2A6B2] uppercase">
            WORKSPACE
          </div>
        )}
        <div className="h-1.5 shrink-0" />

        {/* Nav sem barra de rolagem nativa visual visível */}
        <nav
          aria-label="Navegação principal"
          className="min-h-0 flex-1 space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV_ITEMS.map((item) => {
            const Icone = item.icone;
            const ativo = pathname === item.rota || (item.rota !== "/painel" && pathname.startsWith(`${item.rota}/`));

            return (
              <Link
                key={item.rota}
                href={item.rota}
                onClick={fecharNavegacaoMobile}
                title={compacta ? item.rotulo : undefined}
                aria-label={compacta ? item.rotulo : undefined}
                aria-current={ativo ? "page" : undefined}
                className={`group flex h-11 items-center rounded-[12px] transition-colors duration-150 md:h-10 ${
                  compacta ? "justify-center px-0" : "justify-between px-[10px]"
                } ${
                  ativo
                    ? "bg-[#F2F1F7] text-[#16181D] font-semibold"
                    : "text-[#767A86] hover:bg-[#F2F1F7]"
                }`}
              >
                <div className={`flex items-center ${compacta ? "justify-center" : "gap-[10px]"}`}>
                  <Icone
                    className={`size-[17px] shrink-0 transition-colors ${
                      ativo ? "text-[#16181D]" : "text-[#A2A6B2] group-hover:text-[#16181D]"
                    }`}
                  />
                  {!compacta && (
                    <span className="text-[13px] tracking-[-0.2px]">{item.rotulo}</span>
                  )}
                </div>

                {!compacta && item.contador && Number(item.contador) > 0 && (
                  <span className="rounded-[20px] bg-[#16181D] px-[7px] py-[2px] font-mono text-[10px] font-semibold text-white">
                    {item.contador}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Módulo Ativo Card ─────────────────────────────────────────── */}
        {compacta && (
          <Link
            href="/cidades"
            onClick={fecharNavegacaoMobile}
            title={`Cidades · ${consultaCidadesPendente ? "carregando" : cidadesComErro ? "não foi possível atualizar" : cidadesCountLabel}`}
            aria-label={`Abrir Cidades · ${consultaCidadesPendente ? "carregando quantidade" : cidadesComErro ? "quantidade indisponível" : cidadesCountLabel}`}
            aria-current={cidadesAtivas ? "page" : undefined}
            className={`relative mx-auto mt-2 flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-white/95 bg-[linear-gradient(135deg,#EEE7F9_0%,#E2EDFA_100%)] text-[#3B3F4A] shadow-[0_8px_18px_rgba(67,71,96,.10)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(67,71,96,.14)] ${
              cidadesAtivas ? "ring-2 ring-[#16181D]/20 ring-offset-2" : ""
            }`}
          >
            <MapPinnedIcon className="size-[18px]" />
            <span
              aria-hidden="true"
              className={`absolute right-1.5 top-1.5 size-1.5 rounded-full ${
                cidadesComErro
                  ? "bg-[#E5484D]"
                  : consultaCidadesPendente || cidadesAtualizando
                    ? "animate-pulse bg-[#93B8F2]"
                    : "bg-[#16181D]"
              }`}
            />
          </Link>
        )}

        {!compacta && (
          <div className="shrink-0 mt-2">
            <div className="px-2 font-mono text-[9.5px] font-semibold tracking-[1.4px] text-[#A2A6B2] uppercase">
              MÓDULO ATIVO
            </div>
            <div className="h-2" />

            <div
              style={{
                padding: "12px",
                boxShadow: cidadesAtivas
                  ? "0 12px 26px rgba(67,71,96,.13)"
                  : "0 8px 20px rgba(67,71,96,.08)",
              }}
              className={`rounded-[16px] border bg-[linear-gradient(135deg,rgba(238,231,249,.96)_0%,rgba(226,237,250,.96)_100%)] transition-shadow duration-200 ${
                cidadesAtivas ? "border-white ring-1 ring-[#16181D]/10" : "border-white/95"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="relative flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-white/75 shadow-[0_3px_10px_rgba(22,24,29,.06)]">
                  <MapPinnedIcon className="size-4 text-[#3B3F4A]" />
                  {cidadesAtivas && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-white bg-[#16181D]"
                    />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold tracking-[-0.2px] text-[#16181D]">
                    Cidades
                  </div>
                  <div
                    className={`mt-0.5 truncate text-[11px] ${
                      cidadesComErro ? "font-medium text-[#991B1B]" : "text-[#5A5E6A]"
                    }`}
                  >
                    {cidadesComErro
                      ? "Não foi possível atualizar"
                      : consultaCidadesPendente
                        ? "Carregando carteira…"
                        : cidadesAtivas
                          ? "Carteira municipal em uso"
                          : "Carteira municipal"}
                  </div>
                </div>

                {cidadesComErro ? (
                  <button
                    type="button"
                    onClick={() => void recarregarCidades()}
                    aria-label="Tentar atualizar a quantidade de cidades novamente"
                    title="Tentar novamente"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FFE5E5] text-[#991B1B] transition-colors hover:bg-[#F3C2C2]"
                  >
                    <AlertCircleIcon className="size-4" />
                  </button>
                ) : consultaCidadesPendente ? (
                  <span
                    role="status"
                    aria-label="Carregando quantidade de cidades"
                    className="flex h-7 w-[58px] shrink-0 items-center justify-center rounded-full bg-white/70"
                  >
                    <span className="h-2 w-7 animate-pulse rounded-full bg-[#D6D7DE]" />
                  </span>
                ) : (
                  <span
                    aria-live="polite"
                    className="flex h-7 shrink-0 items-center justify-center rounded-full bg-white/70 px-2.5 font-mono text-[9px] font-semibold text-[#5A5E6A]"
                  >
                    {cidadesCountLabel}
                  </span>
                )}
              </div>

              {cidadesAtivas ? (
                <div
                  aria-current="page"
                  className="mt-[11px] flex h-10 w-full items-center justify-between rounded-full bg-[#16181D] px-3.5 text-white shadow-[0_6px_16px_rgba(22,24,29,.14)]"
                >
                  <span className="truncate text-[11.5px] font-semibold">
                    Você está em Cidades
                  </span>
                  <CheckIcon className="size-3.5 shrink-0 text-white/70" />
                </div>
              ) : (
                <Link
                  href="/cidades"
                  onClick={fecharNavegacaoMobile}
                  className="mt-[11px] flex h-10 w-full items-center justify-between rounded-full bg-[#16181D] px-3.5 text-white shadow-[0_6px_16px_rgba(22,24,29,.14)] transition-colors hover:bg-[#2C2F38] focus-visible:ring-2 focus-visible:ring-[#16181D]/30 focus-visible:ring-offset-2"
                >
                  <span className="truncate text-[11.5px] font-semibold">
                    Abrir cidades
                  </span>
                  <ChevronRightIcon className="size-3.5 shrink-0 text-white/60" />
                </Link>
              )}
            </div>
          </div>
        )}

        <div className={`shrink-0 ${compacta ? "h-3" : "h-4"}`} />

        {/* ── Ajuda e Atalhos ────────────────────────────────────────────── */}
        {!compacta && (
          <div className="relative shrink-0">
            {ajudaAberta && (
              <div
                id="atalhos-sidebar"
                className="absolute bottom-[48px] left-0 z-20 w-full rounded-[16px] border border-white bg-white/97 p-3 shadow-[0_18px_42px_rgba(22,24,29,.16)] backdrop-blur-[14px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-bold text-[#16181D]">Atalhos rápidos</p>
                  <button
                    type="button"
                    onClick={() => setAjudaAberta(false)}
                    aria-label="Fechar ajuda"
                    className="flex size-8 items-center justify-center rounded-full text-[#767A86] hover:bg-[#F2F1F7] hover:text-[#16181D]"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[10.5px] leading-relaxed text-[#767A86]">
                  Acesse as áreas do workspace pelo menu e use o atalho para consultar esta ajuda.
                </p>
                <dl className="mt-2 text-[11px] text-[#5A5E6A]">
                  <div className="flex items-center justify-between gap-3">
                    <dt>Abrir esta ajuda</dt>
                    <dd className="rounded-md border border-[#ECEDF2] bg-[#F7F6FA] px-1.5 py-0.5 font-mono text-[9.5px]">
                      Ctrl /
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <button
              type="button"
              onClick={() => setAjudaAberta((aberta) => !aberta)}
              aria-expanded={ajudaAberta}
              aria-controls="atalhos-sidebar"
              className="flex h-11 w-full items-center gap-[8px] rounded-[12px] px-[10px] text-[#767A86] transition-colors hover:bg-[#F2F1F7] md:h-10"
            >
              <HelpCircleIcon className="size-[16px] text-[#A2A6B2]" />
              <span className="flex-1 text-left text-[12px]">Ajuda e atalhos</span>
              <span className="rounded-[5px] border border-[#ECEDF2] px-[5px] py-[1px] font-mono text-[9px] text-[#767A86]">
                Ctrl /
              </span>
            </button>
          </div>
        )}

        <div className="shrink-0 h-2" />

        {/* ── User Profile Card ──────────────────────────────────────────── */}
        <Link
          href="/ajustes"
          onClick={fecharNavegacaoMobile}
          aria-label={`Abrir ajustes do perfil de ${nomeExibicao}`}
          className={`flex shrink-0 items-center gap-[10px] rounded-[14px] border border-white/95 bg-[#F7F6FA] transition-colors hover:bg-[#ECEBF2] ${
            compacta ? "justify-center p-1.5" : "p-[8px_10px]"
          }`}
        >
          <div className="flex size-[32px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#16181D] to-[#3B3F4A] text-[11.5px] font-bold text-white">
            {iniciais}
          </div>

          {!compacta && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[#16181D]">{nomeExibicao}</p>
                <p className="truncate text-[10px] text-[#767A86]">Admin do grupo</p>
              </div>
              <ChevronRightIcon className="size-[15px] shrink-0 text-[#A2A6B2]" />
            </>
          )}
        </Link>
      </aside>
    </>
  );
}
