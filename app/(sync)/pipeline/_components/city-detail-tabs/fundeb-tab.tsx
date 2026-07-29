"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRightIcon,
  FileTextIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react";

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

export function FundebTab({ city }: FundebTabProps) {
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
      <EmptyState
        title="Código IBGE não cadastrado"
        description="Cadastre o código IBGE na ficha da cidade para consultar o FUNDEB."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[360px] flex-col items-center justify-center">
        <LoaderCircleIcon className="size-6 animate-spin text-[#767A86]" />
        <p className="mt-3 text-[10.5px] text-[#767A86]">
          Consultando o levantamento…
        </p>
      </div>
    );
  }

  if (error || !data?.relatorio) {
    return (
      <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-6 text-center">
        <p className="text-[11px] font-bold text-[#8A3A50]">
          Não foi possível carregar os dados FUNDEB
        </p>
        <p className="mt-1 text-[9.5px] text-[#767A86]">
          {error instanceof Error ? error.message : "Tente novamente."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 flex h-8 items-center gap-1.5 rounded-full bg-[#F2F1F7] px-3 text-[10px] font-bold text-[#5A5E6A]"
        >
          <RefreshCwIcon className="size-3" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const projection =
    data.relatorio.projecaoRecuperavel ?? data.relatorio.projecao ?? {};
  const census = data.relatorio.censoEscolar;

  return (
    <div className="space-y-3 p-4">
      <section className="rounded-[16px] bg-gradient-to-br from-[#252832] to-[#3B3F4A] p-4 text-white">
        <div className="font-mono text-[8.5px] font-bold tracking-[1px] text-white/55 uppercase">
          Diagnóstico FUNDEB atual
        </div>
        <div className="mt-3 font-mono text-[24px] font-bold">
          {formatCurrency(projection.totalAtual ?? 0)}
        </div>
        <div className="mt-4 grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 pt-3">
          <div>
            <div className="font-mono text-[8px] text-white/50">PROJETADO</div>
            <div className="mt-1 font-mono text-[12px] font-bold">
              {formatCurrency(projection.totalProjetado ?? 0)}
            </div>
          </div>
          <div className="pl-3">
            <div className="font-mono text-[8px] text-white/50">
              GANHO RECUPERÁVEL
            </div>
            <div className="mt-1 font-mono text-[12px] font-bold text-[#8FD3B6]">
              +{formatCurrency(projection.totalGanho ?? 0)}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <SmallMetric
          label="Matrículas"
          value={formatInteger(census?.totalMatriculas ?? 0)}
        />
        <SmallMetric
          label="Escolas"
          value={formatInteger(census?.totalEscolas ?? 0)}
        />
        <SmallMetric
          label="VAAF atual"
          value={formatCurrency(projection.vaafAtual ?? 0)}
        />
        <SmallMetric
          label="Ganho"
          value={`${(projection.ganhoPercentual ?? 0).toFixed(1)}%`}
        />
      </section>

      <Link
        href={`/cidades/${city.id}`}
        className="flex h-10 items-center justify-between rounded-[12px] border border-[#F0F1F5] bg-white px-3 text-[10.5px] font-bold text-[#3B3F4A] hover:bg-[#FAFAFC]"
      >
        <span className="flex items-center gap-2">
          <FileTextIcon className="size-3.5 text-[#767A86]" />
          Ver relatórios e versões salvas
        </span>
        <ArrowUpRightIcon className="size-3.5 text-[#A2A6B2]" />
      </Link>

      <Link
        href={`/modulos/levantamento-fundeb?ibge=${city.codigoIbge}`}
        className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#16181D] px-4 text-[10.5px] font-bold text-white hover:bg-[#2C2F38]"
      >
        <SparklesIcon className="size-3.5" />
        Gerar novo relatório
      </Link>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-6 text-center">
      <FileTextIcon className="size-7 text-[#A2A6B2]" />
      <p className="mt-3 text-[11px] font-bold text-[#16181D]">{title}</p>
      <p className="mt-1 text-[9.5px] leading-relaxed text-[#767A86]">
        {description}
      </p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[#F0F1F5] bg-white p-3">
      <div className="text-[8.5px] font-bold text-[#A2A6B2] uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-[12px] font-bold text-[#16181D]">
        {value}
      </div>
    </div>
  );
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}
