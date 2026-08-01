"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ExportOutlined,
  FileTextOutlined,
  ReloadOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { Button, Card, Empty, Result, Skeleton, Typography, theme } from "antd";

import type { CityAccount } from "@/core/lib/city-types";
import { formatCurrency } from "@/core/lib/city-types";

interface FundebTabProps {
  city: CityAccount;
}

interface Projection {
  totalAtual?: number;
  totalProjetado?: number;
  totalGanho?: number;
  ganhoPercentual?: number;
  vaafAtual?: number;
  vaatAtual?: number;
  vaarAtual?: number;
}

interface ReportResponse {
  relatorio?: {
    projecao?: Projection;
    projecaoRecuperavel?: Projection;
    censoEscolar?: {
      totalMatriculas?: number;
      totalEscolas?: number;
    };
  };
}

const FONTE_NUMERO = "var(--font-sync-mono)";

export function FundebTab({ city }: FundebTabProps) {
  const { token } = theme.useToken();
  const { data, isLoading, error, refetch } = useQuery<ReportResponse>({
    queryKey: ["levantamento-fundeb", city.codigoIbge],
    queryFn: async () => {
      if (!city.codigoIbge) throw new Error("Código IBGE não cadastrado.");
      const response = await fetch(
        `/api/modulos/levantamento-fundeb/${city.codigoIbge}`,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Falha ao consultar o levantamento.");
      }
      return response.json();
    },
    enabled: Boolean(city.codigoIbge),
  });

  if (!city.codigoIbge) {
    return (
      <div style={{ padding: 24 }}>
        <Empty
          image={<FileTextOutlined style={{ fontSize: 28, color: token.colorTextQuaternary }} />}
          description={
            <>
              <Typography.Text strong>Código IBGE não cadastrado</Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Cadastre o código IBGE na ficha da cidade para consultar o FUNDEB.
              </Typography.Text>
            </>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    );
  }

  if (error || !data?.relatorio) {
    return (
      <Result
        status="warning"
        title="Não foi possível carregar os dados FUNDEB"
        subTitle={error instanceof Error ? error.message : "Tente novamente."}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const projection =
    data.relatorio.projecaoRecuperavel ?? data.relatorio.projecao ?? {};
  const census = data.relatorio.censoEscolar;

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Cartão escuro com o número principal — mesmo tratamento do KPI do
          topo do pipeline (`pipeline-kpis.tsx`). */}
      <div
        style={{
          borderRadius: token.borderRadiusLG,
          padding: 16,
          color: "#FFFFFF",
          background: `linear-gradient(135deg, ${token.colorPrimary} 0%, #3B3F4A 100%)`,
        }}
      >
        <Typography.Text
          style={{
            color: "rgba(255,255,255,.55)",
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Diagnóstico FUNDEB atual
        </Typography.Text>
        <div style={{ marginTop: 8, fontFamily: FONTE_NUMERO, fontSize: 24, fontWeight: 700 }}>
          {formatCurrency(projection.totalAtual ?? 0)}
        </div>
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,.12)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          <div>
            <Typography.Text style={{ color: "rgba(255,255,255,.5)", fontSize: 8 }}>
              PROJETADO
            </Typography.Text>
            <div style={{ marginTop: 2, fontFamily: FONTE_NUMERO, fontSize: 12, fontWeight: 700 }}>
              {formatCurrency(projection.totalProjetado ?? 0)}
            </div>
          </div>
          <div style={{ borderLeft: "1px solid rgba(255,255,255,.12)", paddingLeft: 12 }}>
            <Typography.Text style={{ color: "rgba(255,255,255,.5)", fontSize: 8 }}>
              GANHO RECUPERÁVEL
            </Typography.Text>
            <div
              style={{
                marginTop: 2,
                fontFamily: FONTE_NUMERO,
                fontSize: 12,
                fontWeight: 700,
                color: token.colorSuccess,
              }}
            >
              +{formatCurrency(projection.totalGanho ?? 0)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <SmallMetric label="Matrículas" value={formatInteger(census?.totalMatriculas ?? 0)} />
        <SmallMetric label="Escolas" value={formatInteger(census?.totalEscolas ?? 0)} />
        <SmallMetric label="VAAF atual" value={formatCurrency(projection.vaafAtual ?? 0)} />
        <SmallMetric label="Ganho" value={`${(projection.ganhoPercentual ?? 0).toFixed(1)}%`} />
      </div>

      <Link href={`/cidades/${city.id}`}>
        <Button
          block
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileTextOutlined style={{ color: token.colorTextTertiary }} />
            Ver relatórios e versões salvas
          </span>
          <ExportOutlined style={{ color: token.colorTextQuaternary }} />
        </Button>
      </Link>

      <Link href={`/modulos/levantamento-fundeb?ibge=${city.codigoIbge}`}>
        <Button block type="primary" icon={<RocketOutlined />}>
          Gerar novo relatório
        </Button>
      </Link>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <Card size="small" styles={{ body: { padding: 12 } }}>
      <Typography.Text
        type="secondary"
        style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase" }}
      >
        {label}
      </Typography.Text>
      <div style={{ marginTop: 4, fontFamily: FONTE_NUMERO, fontSize: 12, fontWeight: 700 }}>
        {value}
      </div>
    </Card>
  );
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}
