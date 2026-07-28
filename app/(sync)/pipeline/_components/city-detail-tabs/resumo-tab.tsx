"use client";

import type { CityAccount } from "@/core/lib/city-types";
import { STAGE_LABELS, formatCurrency } from "@/core/lib/city-types";
import { daysIdle } from "../stage-helpers";

interface ResumoTabProps {
  city: CityAccount;
  onSave: (cityId: string, data: Record<string, unknown>) => void;
}

export function ResumoTab({ city, onSave }: ResumoTabProps) {
  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSave(city.id, { stage: e.target.value });
  };

  const idle = daysIdle(city);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
  };

  return (
    <div className="space-y-5 p-5 font-mono text-[11px]">
      {/* Informações Gerais */}
      <Section title="INFORMAÇÕES GERAIS">
        <Row label="Nome" value={city.name} />
        <Row label="UF" value={city.uf} />
        <Row label="Código IBGE" value={city.codigoIbge || "—"} />
        <Row label="Status" value={city.status} />
      </Section>

      {/* Pipeline */}
      <Section title="PIPELINE">
        <div className="flex items-center justify-between border-b border-line py-[6px]">
          <span className="text-muted">Estágio</span>
          <select
            value={city.stage}
            onChange={handleStageChange}
            className="rounded-[6px] border border-line-input bg-card px-2 py-1 text-right text-[11px] font-medium text-body outline-none focus:border-primary-strong"
          >
            {Object.entries(STAGE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Row label="Probabilidade" value={`${city.probability}%`} />
        <Row
          label="Receita Estimada"
          value={formatCurrency(city.estimatedAnnualRevenue)}
        />
        <Row label="Próximo Passo" value={city.nextStepDescription || "—"} />
        <Row
          label="Data Próx. Passo"
          value={formatDate(city.nextStepDueDate)}
        />
      </Section>

      {/* Responsável */}
      <Section title="RESPONSÁVEL">
        <Row label="Nome" value={city.collaboratorName || "—"} />
        <Row label="ID" value={city.collaboratorId || "—"} />
      </Section>

      {/* Última Atividade */}
      <Section title="ÚLTIMA ATIVIDADE">
        <Row label="Data" value={formatDate(city.lastActivityAt)} />
        <Row
          label="Dias Inativo"
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
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[1px] text-soft">
        {title}
      </h3>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-line py-[6px]">
      <span className="text-muted">{label}</span>
      <span
        className={`text-right font-medium ${
          warn ? "text-warning-dark" : "text-body"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
