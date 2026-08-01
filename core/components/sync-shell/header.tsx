"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AppstoreOutlined,
  BankOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  LoadingOutlined,
  MenuOutlined,
  RiseOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Grid,
  Input,
  Layout,
  List,
  Modal,
  Popover,
  Skeleton,
  Tag,
  Typography,
  theme,
} from "antd";

import { useAuth } from "@/core/providers/auth-provider";
import { listCities } from "@/core/lib/cities-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { STAGE_LABELS, type CityAccount } from "@/core/lib/city-types";

const { Header } = Layout;
const { useBreakpoint } = Grid;
const { Text } = Typography;

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
    icon: DashboardOutlined,
  },
  {
    label: "Cidades",
    description: "Carteira e levantamentos municipais",
    href: "/cidades",
    icon: EnvironmentOutlined,
  },
  {
    label: "Pipeline",
    description: "Etapas e próximas ações",
    href: "/pipeline",
    icon: RiseOutlined,
  },
  {
    label: "Empresas",
    description: "Entidades e módulos contratados",
    href: "/empresas",
    icon: BankOutlined,
  },
  {
    label: "Pessoas",
    description: "Contatos e responsáveis",
    href: "/pessoas",
    icon: TeamOutlined,
  },
  {
    label: "Documentos",
    description: "Arquivos da operação",
    href: "/documentos",
    icon: FolderOpenOutlined,
  },
  {
    label: "Módulos",
    description: "Ferramentas e levantamentos",
    href: "/modulos",
    icon: AppstoreOutlined,
  },
  {
    label: "Caixa de entrada",
    description: "Pendências recebidas",
    href: "/caixa",
    icon: InboxOutlined,
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
  const { token } = theme.useToken();
  const screens = useBreakpoint();
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

  // Ícone e cor do selo de estado da carteira. Cores vêm de token semântico —
  // nunca de hexadecimal solto — para acompanhar claro/escuro automaticamente.
  const iconeStatus = citiesPending ? (
    <LoadingOutlined spin />
  ) : citiesError ? (
    <ExclamationCircleOutlined />
  ) : overdueCount > 0 || alerts.length > 0 ? (
    <ClockCircleOutlined />
  ) : (
    <CheckCircleOutlined />
  );

  const estiloStatus =
    citiesError || overdueCount > 0
      ? { color: token.colorErrorText, backgroundColor: token.colorErrorBg }
      : citiesPending || cities.length === 0
        ? { color: token.colorTextSecondary, backgroundColor: token.colorFillTertiary }
        : alerts.length > 0
          ? { color: token.colorWarningText, backgroundColor: token.colorWarningBg }
          : { color: token.colorSuccessText, backgroundColor: token.colorSuccessBg };

  const rotuloStatus = portfolioStatusLabel(
    citiesPending,
    citiesError,
    cities.length,
    alerts.length,
    overdueCount,
  );

  return (
    <>
      <Header
        style={{
          height: 60,
          lineHeight: "60px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {!screens.md && (
            <Button
              type="text"
              shape="circle"
              icon={<MenuOutlined />}
              onClick={aoAbrirSidebarMobile}
              aria-label="Abrir navegação"
              aria-controls="sync-sidebar"
              aria-expanded={sidebarMobileAberta}
            />
          )}

          <div style={{ minWidth: 0 }}>
            <Text
              type="secondary"
              style={{
                display: "block",
                fontFamily: token.fontFamilyCode,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: 1.3,
              }}
            >
              WORKSPACE
            </Text>
            <Text strong ellipsis style={{ display: "block", fontSize: 15 }}>
              {tituloDaPagina}
            </Text>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {screens.md ? (
          <Button
            onClick={() => {
              setBuscaAberta(true);
              setAlertasAbertos(false);
            }}
            aria-label="Abrir busca global"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: screens.xl ? 310 : 220,
              borderRadius: 22,
              color: token.colorTextSecondary,
            }}
          >
            <SearchOutlined style={{ color: token.colorTextTertiary }} />
            <span
              style={{
                flex: 1,
                textAlign: "left",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Buscar cidade ou área…
            </span>
            <Text keyboard style={{ fontSize: 10 }}>
              Ctrl K
            </Text>
          </Button>
        ) : (
          <Button
            type="text"
            shape="circle"
            icon={<SearchOutlined />}
            onClick={() => {
              setBuscaAberta(true);
              setAlertasAbertos(false);
            }}
            aria-label="Abrir busca global"
          />
        )}

        {screens.xl && (
          <Tag
            icon={iconeStatus}
            bordered={false}
            onClick={() => {
              if (citiesError) return;
              setAlertasAbertos((open) => !open);
              setBuscaAberta(false);
            }}
            style={{
              ...estiloStatus,
              fontFamily: token.fontFamilyCode,
              fontSize: 10,
              fontWeight: 600,
              padding: "4px 10px",
              cursor: citiesError ? "default" : "pointer",
            }}
            aria-label={rotuloStatus}
          >
            {rotuloStatus}
          </Tag>
        )}

        <Popover
          open={alertasAbertos}
          onOpenChange={(open) => {
            setAlertasAbertos(open);
            if (open) setBuscaAberta(false);
          }}
          trigger="click"
          placement="bottomRight"
          styles={{ content: { padding: 0, width: "min(390px, calc(100vw - 24px))" } }}
          content={
            <div>
              <div
                style={{
                  padding: 16,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Text strong style={{ display: "block", fontSize: 14 }}>
                  Ações da carteira
                </Text>
                <Text type="secondary" style={{ display: "block", fontSize: 10, marginTop: 3 }}>
                  Calculadas pelos prazos do pipeline
                </Text>
              </div>

              <div style={{ maxHeight: "min(450px, calc(100vh - 180px))", overflowY: "auto" }}>
                {citiesPending ? (
                  <div style={{ padding: 24 }}>
                    <Skeleton active title={false} paragraph={{ rows: 3 }} />
                  </div>
                ) : citiesError ? (
                  <div style={{ padding: 28, textAlign: "center" }}>
                    <ExclamationCircleOutlined style={{ fontSize: 22, color: token.colorError }} />
                    <div style={{ marginTop: 8, fontSize: 12, color: token.colorText }}>
                      Não foi possível consultar os prazos.
                    </div>
                    <Button size="small" type="link" onClick={() => void refetchCities()}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : alerts.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Nenhuma ação vencendo nos próximos 7 dias."
                    style={{ padding: 28 }}
                  />
                ) : (
                  <List
                    dataSource={alerts}
                    renderItem={(alert) => (
                      <List.Item
                        key={alert.city.id}
                        style={{ cursor: "pointer", padding: "12px 16px" }}
                        onClick={() => navigate(`/cidades/${alert.city.id}`)}
                      >
                        <List.Item.Meta
                          avatar={
                            <Avatar
                              size={34}
                              icon={<ClockCircleOutlined />}
                              style={
                                alert.daysUntilDue < 0
                                  ? { color: token.colorErrorText, backgroundColor: token.colorErrorBg }
                                  : { color: token.colorWarningText, backgroundColor: token.colorWarningBg }
                              }
                            />
                          }
                          title={
                            <span style={{ fontSize: 11.5 }}>
                              {alert.city.nextStepDescription || "Próxima ação sem descrição"}
                            </span>
                          }
                          description={
                            <span style={{ fontSize: 9.5 }}>
                              {alert.city.name} · {alert.city.uf}
                            </span>
                          }
                        />
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            color: alert.daysUntilDue < 0 ? token.colorErrorText : token.colorWarningText,
                          }}
                        >
                          {alert.dueLabel}
                        </Text>
                      </List.Item>
                    )}
                  />
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 16px",
                  background: token.colorFillQuaternary,
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Text
                  type="secondary"
                  style={{ fontFamily: token.fontFamilyCode, fontSize: 8.5 }}
                >
                  {dataUpdatedAt
                    ? `Dados consultados às ${formatTime(dataUpdatedAt)}`
                    : "Carteira do grupo"}
                </Text>
                <Button type="link" size="small" onClick={() => navigate("/pipeline")}>
                  Abrir pipeline
                </Button>
              </div>
            </div>
          }
        >
          <Badge count={alerts.length} size="small" offset={[-4, 4]}>
            <Button
              type="text"
              shape="circle"
              icon={<BellOutlined />}
              aria-label={
                alerts.length
                  ? `${alerts.length} ações com prazo próximo`
                  : "Ações da carteira"
              }
              aria-expanded={alertasAbertos}
            />
          </Badge>
        </Popover>
      </Header>

      <Modal
        open={buscaAberta}
        onCancel={() => setBuscaAberta(false)}
        footer={null}
        title={null}
        width={680}
        destroyOnHidden
        aria-label="Busca global"
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: 16, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Input
            autoFocus
            size="large"
            allowClear
            variant="borderless"
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary, marginInlineEnd: 4 }} />}
            placeholder="Busque por cidade, IBGE ou área do sistema"
            aria-label="Termo da busca global"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              const primeiroResultado = matchedCities[0]
                ? `/cidades/${matchedCities[0].id}`
                : matchedAreas[0]?.href;
              if (primeiroResultado) navigate(primeiroResultado);
            }}
          />
        </div>

        <div style={{ maxHeight: "min(500px, calc(100vh - 260px))", overflowY: "auto", padding: 8 }}>
          {citiesPending && (
            <div style={{ padding: 24 }}>
              <Skeleton active title={false} paragraph={{ rows: 4 }} />
            </div>
          )}

          {!citiesPending && matchedCities.length === 0 && matchedAreas.length === 0 && (
            <Empty
              description="Tente o nome do município, código IBGE ou uma área do sistema."
              style={{ padding: 32 }}
            />
          )}

          {matchedCities.length > 0 && (
            <List
              header={
                <SectionLabel>
                  {normalizedSearch ? "Municípios" : "Cidades recentes"}
                </SectionLabel>
              }
              dataSource={matchedCities}
              split={false}
              renderItem={(city) => (
                <List.Item
                  key={city.id}
                  style={{ cursor: "pointer", borderRadius: token.borderRadiusLG, padding: "7px 10px" }}
                  onClick={() => navigate(`/cidades/${city.id}`)}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={<EnvironmentOutlined />}
                        style={{ color: token.colorSuccessText, backgroundColor: token.colorSuccessBg }}
                      />
                    }
                    title={<span style={{ fontSize: 12 }}>{city.name}</span>}
                    description={
                      <span style={{ fontSize: 9.5 }}>
                        {city.uf} · IBGE {city.codigoIbge || "não informado"} ·{" "}
                        {STAGE_LABELS[city.stage] ?? city.stage}
                      </span>
                    }
                  />
                  <Text type="secondary" style={{ fontSize: 9, fontWeight: 600 }}>
                    Abrir
                  </Text>
                </List.Item>
              )}
            />
          )}

          {matchedAreas.length > 0 && (
            <List
              header={<SectionLabel>Áreas do sistema</SectionLabel>}
              dataSource={matchedAreas}
              split={false}
              renderItem={(area) => {
                const Icon = area.icon;
                return (
                  <List.Item
                    key={area.href}
                    style={{ cursor: "pointer", borderRadius: token.borderRadiusLG, padding: "7px 10px" }}
                    onClick={() => navigate(area.href)}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          icon={<Icon />}
                          style={{ color: token.colorTextSecondary, backgroundColor: token.colorFillTertiary }}
                        />
                      }
                      title={<span style={{ fontSize: 12 }}>{area.label}</span>}
                      description={<span style={{ fontSize: 9.5 }}>{area.description}</span>}
                    />
                    <Text type="secondary" style={{ fontSize: 9, fontWeight: 600 }}>
                      Acessar
                    </Text>
                  </List.Item>
                );
              }}
            />
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "7px 16px",
            background: token.colorFillQuaternary,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Text type="secondary" style={{ fontSize: 9 }}>
            <Text keyboard style={{ fontSize: 9 }}>Ctrl</Text> <Text keyboard style={{ fontSize: 9 }}>K</Text> para abrir
          </Text>
          <Text type="secondary" style={{ fontSize: 9 }}>
            Resultados da carteira do seu grupo
          </Text>
        </div>
      </Modal>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <Text
      type="secondary"
      style={{
        display: "block",
        padding: "0 2px",
        fontFamily: token.fontFamilyCode,
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: 0.65,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
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

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}
