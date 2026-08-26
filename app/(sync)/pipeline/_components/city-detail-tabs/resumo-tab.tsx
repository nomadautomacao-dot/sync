"use client";

import type { ReactNode } from "react";
import { Select, Typography, theme } from "antd";

import type { CityAccount } from "@/core/lib/city-types";
import { STAGE_LABELS, formatCurrency } from "@/core/lib/city-types";
import { daysIdle } from "../stage-helpers";

interface ResumoTabProps {
  city: CityAccount;
  onSave: (cityId: string, data: Record<string, unknown>) => void;
}

const FONTE_NUMERO = "var(--font-sync-mono)";

export function ResumoTab({ city, onSave }: ResumoTabProps) {
  const idle = daysIdle(city);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
  };

  return (
    <div style={{ padding: 20 }}>
      <Section title="Informações gerais">
        <Row label="Nome" value={city.name} />
        <Row label="UF" value={city.uf} />
        <Row label="Código IBGE" value={city.codigoIbge || "—"} />
        <Row label="Status" value={city.status} />
      </Section>

      <Section title="Pipeline">
        <StageRow city={city} onSave={onSave} />
        <Row label="Probabilidade" value={`${city.probability}%`} />
        <Row label="Receita estimada" value={formatCurrency(city.estimatedAnnualRevenue)} />
        <Row label="Próximo passo" value={city.nextStepDescription || "—"} />
        <Row label="Data próx. passo" value={formatDate(city.nextStepDueDate)} />
      </Section>

      <Section title="Responsáveis">
        <Row label="Parceiro (agenciou)" value={city.parceiroName || "—"} />
        <Row
          label="Resp. técnico"
          value={city.collaboratorName || "—"}
          warn={!city.collaboratorName}
        />
      </Section>

      <Section title="Última atividade" last>
        <Row label="Data" value={formatDate(city.lastActivityAt)} />
        <Row
          label="Dias inativo"
          value={idle !== null ? `${idle} dias` : "—"}
          warn={idle !== null && idle > 7}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div style={{ marginBottom: last ? 0 : 20 }}>
      <Typography.Text
        type="secondary"
        style={{
          display: "block",
          marginBottom: 6,
          fontFamily: FONTE_NUMERO,
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Typography.Text>
      {children}
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        padding: "6px 0",
      }}
    >
      <Typography.Text type="secondary" style={{ fontFamily: FONTE_NUMERO, fontSize: 11 }}>
        {label}
      </Typography.Text>
      <Typography.Text
        style={{
          fontFamily: FONTE_NUMERO,
          fontSize: 11,
          fontWeight: 500,
          textAlign: "right",
          color: warn ? token.colorWarningText : token.colorText,
        }}
      >
        {value}
      </Typography.Text>
    </div>
  );
}

/** Único campo editável da aba — muda o estágio direto no pipeline. */
function StageRow({ city, onSave }: ResumoTabProps) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        padding: "6px 0",
      }}
    >
      <Typography.Text type="secondary" style={{ fontFamily: FONTE_NUMERO, fontSize: 11 }}>
        Estágio
      </Typography.Text>
      <Select
        size="small"
        value={city.stage}
        style={{ minWidth: 170 }}
        onChange={(value) => onSave(city.id, { stage: value })}
        options={Object.entries(STAGE_LABELS).map(([key, label]) => ({
          value: key,
          label,
        }))}
      />
    </div>
  );
}
