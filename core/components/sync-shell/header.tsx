"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  BellIcon,
  BoxesIcon,
  Building2Icon,
  CalendarClockIcon,
  CheckCircle2Icon,
  FolderArchiveIcon,
  InboxIcon,
  LayoutDashboardIcon,
  LoaderCircleIcon,
  MapPinnedIcon,
  MenuIcon,
  SearchIcon,
  TrendingUpIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";

import { useAuth } from "@/core/providers/auth-provider";
import { listCities } from "@/core/lib/cities-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import {
  STAGE_LABELS,
  type CityAccount,
} from "@/core/lib/city-types";

import styles from "./header.module.css";

interface SyncHeaderProps {
  sidebarMobileAberta: boolean;
  aoAbrirSidebarMobile: () => void;
}

interface AreaSearchItem {
  label: string;
  description: string;
  href: string;
  icon: ElementType;
}

interface CityAlert {
  city: CityAccount;
  daysUntilDue: number;
  dueLabel: string;
}

const AREAS: readonly AreaSearchItem[] = [
  {
    label: "Painel",
    description: "Visão executiva do workspace",
    href: "/painel",
    icon: LayoutDashboardIcon,
  },
  {
    label: "Cidades",
    description: "Carteira e levantamentos municipais",
    href: "/cidades",
    icon: MapPinnedIcon,
  },
  {
    label: "Pipeline",
    description: "Etapas e próximas ações",
    href: "/pipeline",
    icon: TrendingUpIcon,
  },
  {
    label: "Empresas",
    description: "Entidades e módulos contratados",
    href: "/empresas",
    icon: Building2Icon,
  },
  {
    label: "Pessoas",
    description: "Contatos e responsáveis",
    href: "/pessoas",
    icon: UsersIcon,
  },
  {
    label: "Documentos",
    description: "Arquivos da operação",
    href: "/documentos",
    icon: FolderArchiveIcon,
  },
  {
    label: "Módulos",
    description: "Ferramentas e levantamentos",
    href: "/modulos",
    icon: BoxesIcon,
  },
  {
    label: "Caixa de entrada",
    description: "Pendências recebidas",
    href: "/caixa",
    icon: InboxIcon,
  },
];

const TITULOS_DAS_ROTAS = Object.fromEntries(
  AREAS.map((area) => [area.href, area.label]),
) as Record<string, string>;

export function SyncHeader({
  sidebarMobileAberta,
  aoAbrirSidebarMobile,
}: SyncHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const [alertasAbertos, setAlertasAbertos] = useState(false);

  const {
    data: cities = [],
    isPending: citiesPending,
    isError: citiesError,
    refetch: refetchCities,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["cities", user?.groupId],
    queryFn: () => listCities(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  const rotaCorrespondente = Object.keys(TITULOS_DAS_ROTAS).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const tituloDaPagina = rotaCorrespondente
    ? TITULOS_DAS_ROTAS[rotaCorrespondente]
    : "Painel";

  const alerts = useMemo(() => buildCityAlerts(cities), [cities]);
  const overdueCount = alerts.filter(
    (alert) => alert.daysUntilDue < 0,
  ).length;
  const normalizedSearch = normalizeSearch(busca);

  const matchedCities = useMemo(() => {
    const ordered = [...cities].sort(compareCitiesByActivity);
    if (!normalizedSearch) return ordered.slice(0, 5);

    return ordered
      .filter((city) =>
        normalizeSearch(
          `${city.name} ${city.uf} ${city.codigoIbge} ${
            STAGE_LABELS[city.stage] ?? city.stage
          }`,
        ).includes(normalizedSearch),
      )
      .slice(0, 8);
  }, [cities, normalizedSearch]);

  const matchedAreas = useMemo(() => {
    if (!normalizedSearch) return AREAS.slice(0, 4);
    return AREAS.filter((area) =>
      normalizeSearch(`${area.label} ${area.description}`).includes(
        normalizedSearch,
      ),
    );
  }, [normalizedSearch]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setBuscaAberta(true);
        setAlertasAbertos(false);
      }
      if (event.key === "Escape") {
        setBuscaAberta(false);
        setAlertasAbertos(false);
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  const navigate = (href: string) => {
    setBuscaAberta(false);
    setAlertasAbertos(false);
    setBusca("");
    router.push(href);
  };

  return (
    <>
      <header className="relative z-40 flex h-[60px] shrink-0 items-center justify-between gap-2 rounded-[18px] border border-white/95 bg-white/90 px-3 shadow-[0_10px_26px_rgba(22,24,29,.06)] backdrop-blur-xl sm:gap-3 sm:px-[18px]">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={aoAbrirSidebarMobile}
            aria-label="Abrir navegação"
            aria-controls="sync-sidebar"
            aria-expanded={sidebarMobileAberta}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F2F1F7] text-[#3B3F4A] transition-colors hover:bg-[#ECEBF2] md:hidden"
          >
            <MenuIcon className="size-[18px]" />
          </button>

          <div className="min-w-0 whitespace-nowrap">
            <div className="font-mono text-[9px] font-semibold tracking-[1.3px] text-[#A2A6B2]">
              WORKSPACE
            </div>
            <h1 className="mt-[1px] truncate text-[15px] font-bold tracking-[-0.35px] text-[#16181D]">
              {tituloDaPagina}
            </h1>
          </div>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => {
            setBuscaAberta(true);
            setAlertasAbertos(false);
          }}
          className="hidden h-[38px] w-[220px] items-center gap-[9px] rounded-[22px] border border-white bg-[#F2F1F7] px-[14px] text-left transition-colors hover:bg-[#ECEBF2] md:flex xl:w-[310px]"
          aria-label="Abrir busca global"
        >
          <SearchIcon className="size-[16px] shrink-0 text-[#A2A6B2]" />
          <span className="flex-1 truncate text-[13px] text-[#767A86]">
            Buscar cidade ou área…
          </span>
          <span className="rounded-[5px] bg-white px-[6px] py-[1px] font-mono text-[10px] text-[#767A86]">
            Ctrl K
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setBuscaAberta(true);
            setAlertasAbertos(false);
          }}
          aria-label="Abrir busca global"
          className="flex size-[36px] items-center justify-center rounded-full bg-[#F2F1F7] text-[#3B3F4A] transition-colors hover:bg-[#ECEBF2] md:hidden"
        >
          <SearchIcon className="size-[17px]" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (!citiesError) setAlertasAbertos((open) => !open);
            setBuscaAberta(false);
          }}
          className={`hidden items-center gap-2 whitespace-nowrap rounded-full px-3 py-[7px] font-mono text-[10px] font-semibold xl:flex ${portfolioStatusClass(
            citiesPending,
            citiesError,
            cities.length,
            alerts.length,
            overdueCount,
          )}`}
          aria-label={portfolioStatusLabel(
            citiesPending,
            citiesError,
            cities.length,
            alerts.length,
            overdueCount,
          )}
        >
          {citiesPending ? (
            <LoaderCircleIcon className="size-[14px] animate-spin" />
          ) : citiesError ? (
            <AlertCircleIcon className="size-[14px]" />
          ) : overdueCount > 0 || alerts.length > 0 ? (
            <CalendarClockIcon className="size-[14px]" />
          ) : (
            <CheckCircle2Icon className="size-[14px]" />
          )}
          {portfolioStatusLabel(
            citiesPending,
            citiesError,
            cities.length,
            alerts.length,
            overdueCount,
          )}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setAlertasAbertos((open) => !open);
              setBuscaAberta(false);
            }}
            className={`relative flex size-[36px] items-center justify-center rounded-full transition-colors ${
              alertasAbertos
                ? "bg-[#ECEBF2]"
                : "bg-[#F2F1F7] hover:bg-[#ECEBF2]"
            }`}
            aria-label={
              alerts.length
                ? `${alerts.length} ações com prazo próximo`
                : "Ações da carteira"
            }
            aria-expanded={alertasAbertos}
          >
            <BellIcon className="size-[18px] text-[#3B3F4A]" />
            {alerts.length > 0 && (
              <span className="absolute right-[3px] top-[3px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full border-[1.5px] border-white bg-[#16181D] px-[3px] font-mono text-[8px] font-semibold text-white">
                {alerts.length > 9 ? "9+" : alerts.length}
              </span>
            )}
          </button>

          {alertasAbertos && (
            <div className={styles.alertPopover}>
              <div className={styles.popoverHeader}>
                <div>
                  <strong>Ações da carteira</strong>
                  <span>Calculadas pelos prazos do pipeline</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAlertasAbertos(false)}
                  aria-label="Fechar ações da carteira"
                >
                  <XIcon />
                </button>
              </div>

              <div className={styles.alertList}>
                {citiesPending ? (
                  <div className={styles.popoverState}>
                    <LoaderCircleIcon className="animate-spin" />
                    <span>Consultando a carteira…</span>
                  </div>
                ) : citiesError ? (
                  <div className={styles.popoverState}>
                    <AlertCircleIcon />
                    <strong>Não foi possível consultar os prazos.</strong>
                    <button
                      type="button"
                      onClick={() => void refetchCities()}
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : alerts.length === 0 ? (
                  <div className={styles.popoverState}>
                    <CheckCircle2Icon className={styles.successIcon} />
                    <strong>Nenhuma ação vencendo nos próximos 7 dias.</strong>
                    <span>
                      Novos alertas aparecem quando um prazo é salvo no
                      pipeline.
                    </span>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <button
                      type="button"
                      key={alert.city.id}
                      onClick={() => navigate(`/cidades/${alert.city.id}`)}
                      className={styles.alertItem}
                    >
                      <span
                        className={
                          alert.daysUntilDue < 0
                            ? styles.overdueIcon
                            : styles.dueIcon
                        }
                      >
                        <CalendarClockIcon />
                      </span>
                      <span>
                        <strong>
                          {alert.city.nextStepDescription ||
                            "Próxima ação sem descrição"}
                        </strong>
                        <small>
                          {alert.city.name} · {alert.city.uf}
                        </small>
                      </span>
                      <em
                        className={
                          alert.daysUntilDue < 0
                            ? styles.overdueText
                            : undefined
                        }
                      >
                        {alert.dueLabel}
                      </em>
                    </button>
                  ))
                )}
              </div>

              <div className={styles.popoverFooter}>
                <span>
                  {dataUpdatedAt
                    ? `Dados consultados às ${formatTime(dataUpdatedAt)}`
                    : "Carteira do grupo"}
                </span>
                <button type="button" onClick={() => navigate("/pipeline")}>
                  Abrir pipeline
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {buscaAberta && (
        <div
          className={styles.searchBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setBuscaAberta(false);
          }}
        >
          <section
            className={styles.searchDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Busca global"
          >
            <div className={styles.searchInputRow}>
              <SearchIcon aria-hidden="true" />
              <input
                autoFocus
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  const firstResult = matchedCities[0]
                    ? `/cidades/${matchedCities[0].id}`
                    : matchedAreas[0]?.href;
                  if (firstResult) navigate(firstResult);
                }}
                placeholder="Busque por cidade, IBGE ou área do sistema"
                aria-label="Termo da busca global"
              />
              <button
                type="button"
                onClick={() => setBuscaAberta(false)}
                aria-label="Fechar busca"
              >
                <span>Esc</span>
                <XIcon />
              </button>
            </div>

            <div className={styles.searchContent}>
              {citiesPending && (
                <div className={styles.searchLoading}>
                  <LoaderCircleIcon className="animate-spin" />
                  Consultando sua carteira…
                </div>
              )}

              {!citiesPending &&
                matchedCities.length === 0 &&
                matchedAreas.length === 0 && (
                  <div className={styles.noResults}>
                    <SearchIcon />
                    <strong>Nenhum resultado encontrado</strong>
                    <span>
                      Tente o nome do município, código IBGE ou uma área do
                      sistema.
                    </span>
                  </div>
                )}

              {matchedCities.length > 0 && (
                <SearchSection
                  label={normalizedSearch ? "Municípios" : "Cidades recentes"}
                >
                  {matchedCities.map((city) => (
                    <button
                      type="button"
                      key={city.id}
                      onClick={() => navigate(`/cidades/${city.id}`)}
                      className={styles.searchResult}
                    >
                      <span className={styles.cityResultIcon}>
                        <MapPinnedIcon />
                      </span>
                      <span>
                        <strong>{city.name}</strong>
                        <small>
                          {city.uf} · IBGE {city.codigoIbge || "não informado"}{" "}
                          · {STAGE_LABELS[city.stage] ?? city.stage}
                        </small>
                      </span>
                      <em>Abrir</em>
                    </button>
                  ))}
                </SearchSection>
              )}

              {matchedAreas.length > 0 && (
                <SearchSection label="Áreas do sistema">
                  {matchedAreas.map((area) => {
                    const Icon = area.icon;
                    return (
                      <button
                        type="button"
                        key={area.href}
                        onClick={() => navigate(area.href)}
                        className={styles.searchResult}
                      >
                        <span className={styles.areaResultIcon}>
                          <Icon />
                        </span>
                        <span>
                          <strong>{area.label}</strong>
                          <small>{area.description}</small>
                        </span>
                        <em>Acessar</em>
                      </button>
                    );
                  })}
                </SearchSection>
              )}
            </div>

            <footer className={styles.searchFooter}>
              <span>
                <kbd>Ctrl</kbd> <kbd>K</kbd> para abrir
              </span>
              <span>Resultados da carteira do seu grupo</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function SearchSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.searchSection}>
      <h2>{label}</h2>
      <div>{children}</div>
    </section>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function compareCitiesByActivity(a: CityAccount, b: CityAccount): number {
  const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
  const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
  if (aTime !== bTime) return bTime - aTime;
  return a.name.localeCompare(b.name, "pt-BR");
}

function buildCityAlerts(cities: CityAccount[]): CityAlert[] {
  const today = startOfLocalDay(new Date());

  return cities
    .flatMap((city) => {
      if (!city.nextStepDueDate) return [];
      const due = parseLocalDate(city.nextStepDueDate);
      if (!due) return [];

      const daysUntilDue = Math.round(
        (due.getTime() - today.getTime()) / 86_400_000,
      );
      if (daysUntilDue > 7) return [];

      return [
        {
          city,
          daysUntilDue,
          dueLabel: formatDueLabel(daysUntilDue),
        },
      ];
    })
    .sort(
      (a, b) =>
        a.daysUntilDue - b.daysUntilDue ||
        a.city.name.localeCompare(b.city.name, "pt-BR"),
    );
}

function parseLocalDate(value: string): Date | null {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfLocalDay(date);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDueLabel(daysUntilDue: number): string {
  if (daysUntilDue < -1) return `Atrasada há ${Math.abs(daysUntilDue)} dias`;
  if (daysUntilDue === -1) return "Atrasada há 1 dia";
  if (daysUntilDue === 0) return "Vence hoje";
  if (daysUntilDue === 1) return "Vence amanhã";
  return `Vence em ${daysUntilDue} dias`;
}

function portfolioStatusLabel(
  pending: boolean,
  error: boolean,
  cityCount: number,
  alertCount: number,
  overdueCount: number,
): string {
  if (pending) return "Atualizando carteira";
  if (error) return "Carteira indisponível";
  if (cityCount === 0) return "Carteira vazia";
  if (overdueCount === 1) return "1 ação atrasada";
  if (overdueCount > 1) return `${overdueCount} ações atrasadas`;
  if (alertCount === 1) return "1 prazo próximo";
  if (alertCount > 1) return `${alertCount} prazos próximos`;
  return "Carteira em dia";
}

function portfolioStatusClass(
  pending: boolean,
  error: boolean,
  cityCount: number,
  alertCount: number,
  overdueCount: number,
): string {
  if (error || overdueCount > 0) return "bg-[#FBE9EE] text-[#8A3A50]";
  if (pending || cityCount === 0) return "bg-[#F2F1F7] text-[#767A86]";
  if (alertCount > 0) return "bg-[#FBF0D9] text-[#8A5A00]";
  return "bg-[#E4F4EC] text-[#1F6A47]";
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}
