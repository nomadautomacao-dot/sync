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
  PanelLeftOpenIcon,
  ChevronRightIcon,
  HelpCircleIcon,
  XIcon,
} from "lucide-react";

import { useAuth } from "@/core/providers/auth-provider";

interface ItemDeNavegacao {
  rotulo: string;
  /**
   * Nome que aparece sob o ícone com a barra recolhida. A faixa tem 68px:
   * o rótulo inteiro ("Caixa de entrada") não cabe, e sem nenhum rótulo a
   * barra vira nove ícones cinza indistinguíveis — que foi a queixa.
   */
  rotuloCurto?: string;
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
  { rotulo: "Caixa de entrada", rotuloCurto: "Caixa", rota: "/caixa", icone: InboxIcon },
  { rotulo: "Cidades", rota: "/cidades", icone: MapPinnedIcon },
  { rotulo: "Pipeline", rota: "/pipeline", icone: TrendingUpIcon },
  { rotulo: "Empresas", rota: "/empresas", icone: Building2Icon },
  { rotulo: "Pessoas", rota: "/pessoas", icone: UsersIcon },
  { rotulo: "Documentos", rotuloCurto: "Docs", rota: "/documentos", icone: FolderArchiveIcon },
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
            // Só o logo aqui não dizia que a barra volta a abrir. No passar do
            // mouse ele cede lugar ao ícone de expandir, que diz.
            <button
              type="button"
              onClick={() => setRecolhida(false)}
              title="Expandir barra lateral"
              aria-label="Expandir barra lateral"
              className="group/expandir mx-auto flex size-10 items-center justify-center rounded-xl border border-[#F0F1F5] bg-white p-0.5 shadow-2xs transition-transform hover:scale-105"
            >
              <Image
                src="/global-sync-icon.png"
                alt="Global Sync"
                width={34}
                height={34}
                priority
                className="size-8 shrink-0 rounded-md group-hover/expandir:hidden"
              />
              <PanelLeftOpenIcon
                aria-hidden="true"
                className="hidden size-[18px] text-[#3B3F4A] group-hover/expandir:block"
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
                className={`group relative flex items-center rounded-[12px] transition-colors duration-150 ${
                  compacta
                    ? "flex-col justify-center gap-[3px] px-0.5 py-[7px]"
                    : "h-11 justify-between px-[10px] md:h-10"
                } ${
                  ativo
                    ? "bg-[#F2F1F7] text-[#16181D] font-semibold"
                    : "text-[#767A86] hover:bg-[#F2F1F7]"
                }`}
              >
                {/* Com a barra recolhida o fundo cinza sozinho é discreto demais
                    para dizer onde se está; a marca na borda resolve de longe. */}
                {compacta && ativo && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#16181D]"
                  />
                )}

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

                {compacta && (
                  <span
                    className={`max-w-full truncate text-[9px] leading-none tracking-[-0.1px] transition-colors ${
                      ativo ? "font-semibold text-[#16181D]" : "text-[#8C909C] group-hover:text-[#16181D]"
                    }`}
                  >
                    {item.rotuloCurto ?? item.rotulo}
                  </span>
                )}

                {!compacta && item.contador && Number(item.contador) > 0 && (
                  <span className="rounded-[20px] bg-[#16181D] px-[7px] py-[2px] font-mono text-[10px] font-semibold text-white">
                    {item.contador}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

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
