"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  DownloadIcon,
  FileCheck2Icon,
  FileTextIcon,
  LoaderCircleIcon,
  ScaleIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import type { CityAccount } from "@/core/lib/city-types";
import type {
  ContratoFundebCampoMeta,
  ContratosFundebData,
} from "@/modules/contrato-fundeb/types";
import type { ContractAgentStats } from "@/modules/documentos/types";

interface AgentResponse {
  success: boolean;
  contrato: ContratosFundebData;
  metas: ContratoFundebCampoMeta[];
  stats: ContractAgentStats;
  warnings: string[];
  error?: string;
}

interface ContractGeneratorProps {
  cities: CityAccount[];
  onArchive: (
    file: File,
    city: CityAccount,
    title: string,
    contractNumber?: string,
  ) => Promise<void>;
}

const REVIEW_FIELDS: {
  key: keyof ContratosFundebData;
  label: string;
  placeholder?: string;
}[] = [
  { key: "municipioCNPJ", label: "CNPJ da Prefeitura" },
  { key: "municipioEndereco", label: "Endereço da Prefeitura" },
  { key: "fundoCNPJ", label: "CNPJ do Fundo de Educação" },
  { key: "prefeitoNome", label: "Prefeito(a)" },
  { key: "prefeitoCPF", label: "CPF do(a) prefeito(a)" },
  { key: "secretarioNome", label: "Secretário(a) de Educação" },
  { key: "fiscalNome", label: "Fiscal do contrato" },
  { key: "contratoNumero", label: "Número do contrato", placeholder: "001/2026" },
  { key: "processoNumero", label: "Processo administrativo" },
  { key: "foroComarca", label: "Comarca do foro" },
];

export function ContractGenerator({
  cities,
  onArchive,
}: ContractGeneratorProps) {
  const [cityId, setCityId] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("27500");
  const [months, setMonths] = useState("12");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [archive, setArchive] = useState(true);
  const [result, setResult] = useState<AgentResponse | null>(null);

  const selectedCity = useMemo(
    () => cities.find((city) => city.id === cityId),
    [cities, cityId],
  );

  const analyze = async () => {
    if (!selectedCity) {
      toast.error("Selecione um município.");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const response = await fetch("/api/contratos-fundeb/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipioNome: selectedCity.name,
          uf: selectedCity.uf,
          codigoIBGE: selectedCity.codigoIbge || undefined,
          exercicio: Number(year),
          valorMensal: Number(monthlyValue),
          quantidadeMeses: Number(months),
        }),
      });
      const data = (await response.json()) as AgentResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.warnings?.[0] || "Falha na análise.");
      }
      setResult(data);
      toast.success("Minuta preparada para revisão.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar o contrato.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const updateContractField = (
    key: keyof ContratosFundebData,
    value: string,
  ) => {
    setResult((current) =>
      current
        ? {
            ...current,
            contrato: { ...current.contrato, [key]: value },
          }
        : current,
    );
  };

  const generate = async () => {
    if (!result || !selectedCity) return;
    setGenerating(true);
    try {
      const response = await fetch("/api/contratos-fundeb/generate-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contrato: result.contrato }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Falha ao gerar o kit documental.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const responseName = disposition.match(/filename="([^"]+)"/)?.[1];
      const fileName =
        responseName ||
        `Kit_Contrato_${selectedCity.name.replace(/\s+/g, "_")}_${year}.zip`;
      const file = new File([blob], fileName, {
        type: response.headers.get("Content-Type") || "application/zip",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      if (archive) {
        await onArchive(
          file,
          selectedCity,
          `Kit contratual FUNDEB ${year}`,
          String(result.contrato.contratoNumero ?? ""),
        );
      }

      toast.success(
        archive
          ? "Kit gerado, baixado e salvo no acervo."
          : "Kit gerado e baixado.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível gerar o kit.",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid min-h-[560px] gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(520px,1.2fr)]">
      <section className="glass-card flex flex-col p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#EEE7F9] to-[#E2EDFA]">
            <SparklesIcon className="size-5 text-[#3B3F4A]" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold tracking-[-0.3px] text-[#16181D]">
              Novo contrato inteligente
            </h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#767A86]">
              Escolha o município. O sistema consulta as bases disponíveis,
              preenche o modelo e separa o que precisa de revisão humana.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Modelo documental">
            <div className="rounded-[14px] border border-[#D7E4F4] bg-[#F3F7FC] p-3.5">
              <div className="flex items-center gap-2.5">
                <FileCheck2Icon className="size-[18px] text-[#2C4E82]" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-[#16181D]">
                    Inexigibilidade · Consultoria FUNDEB
                  </div>
                  <div className="mt-0.5 font-mono text-[9.5px] text-[#5A5E6A]">
                    14 documentos DOCX · modelo ativo
                  </div>
                </div>
                <CheckCircle2Icon className="size-4 text-[#1F6A47]" />
              </div>
            </div>
          </Field>

          <Field label="Município">
            <select
              value={cityId}
              onChange={(event) => {
                setCityId(event.target.value);
                setResult(null);
              }}
              className="h-10 w-full rounded-[12px] border border-[#E2E3E9] bg-white px-3 text-[12.5px] font-medium text-[#16181D] outline-none focus:border-[#16181D] focus:ring-2 focus:ring-[#16181D]/10"
            >
              <option value="">Selecione o município</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} · {city.uf}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Exercício">
              <Input
                type="number"
                min="2024"
                max="2100"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="h-10 rounded-[12px] text-[12px]"
              />
            </Field>
            <Field label="Valor mensal">
              <Input
                type="number"
                min="0"
                step="100"
                value={monthlyValue}
                onChange={(event) => setMonthlyValue(event.target.value)}
                className="h-10 rounded-[12px] text-[12px]"
              />
            </Field>
            <Field label="Meses">
              <Input
                type="number"
                min="1"
                max="60"
                value={months}
                onChange={(event) => setMonths(event.target.value)}
                className="h-10 rounded-[12px] text-[12px]"
              />
            </Field>
          </div>

          <div className="rounded-[14px] border border-[#F0F1F5] bg-[#FAFAFC] p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#3B3F4A]">
              <ScaleIcon className="size-4" />
              Base legal do modelo
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-[#767A86]">
              Lei Federal nº 14.133/2021, com estrutura de DFD, ETP, Termo de
              Referência, pareceres, ratificação, homologação e minuta.
            </p>
          </div>
        </div>

        <div className="mt-auto pt-5">
          <Button
            type="button"
            onClick={analyze}
            disabled={analyzing || !cityId}
            className="h-11 w-full rounded-full bg-[#16181D] text-[12.5px] font-bold text-white hover:bg-[#2C2F38]"
          >
            {analyzing ? (
              <>
                <LoaderCircleIcon className="size-4 animate-spin" />
                Consultando bases e preparando…
              </>
            ) : (
              <>
                <BotIcon className="size-4" />
                Preparar minuta para revisão
                <ChevronRightIcon className="ml-auto size-4" />
              </>
            )}
          </Button>
        </div>
      </section>

      <section className="glass-card min-w-0 overflow-hidden">
        {!result ? (
          <div className="flex h-full min-h-[560px] flex-col items-center justify-center px-8 text-center">
            <div className="relative flex size-[76px] items-center justify-center rounded-[24px] bg-[#F2F1F7]">
              <FileTextIcon className="size-8 text-[#767A86]" />
              <span className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-[10px] border-4 border-white bg-[#E2EDFA]">
                <SparklesIcon className="size-3 text-[#2C4E82]" />
              </span>
            </div>
            <h3 className="mt-5 text-[15px] font-bold text-[#16181D]">
              A revisão aparecerá aqui
            </h3>
            <p className="mt-2 max-w-[380px] text-[11.5px] leading-relaxed text-[#767A86]">
              Antes de gerar o arquivo, você verá os dados encontrados, as
              fontes utilizadas e os campos que ainda precisam ser confirmados.
            </p>
            <div className="mt-6 flex items-center gap-2 font-mono text-[9.5px] text-[#A2A6B2]">
              <span className="rounded-full bg-[#E2EDFA] px-2.5 py-1">IBGE</span>
              <span className="rounded-full bg-[#DFF2E7] px-2.5 py-1">TSE</span>
              <span className="rounded-full bg-[#FBF0D9] px-2.5 py-1">
                CNPJ
              </span>
              <span className="rounded-full bg-[#EEE7F9] px-2.5 py-1">
                Dados públicos
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-full max-h-[calc(100vh-190px)] min-h-[560px] flex-col">
            <div className="flex items-start justify-between border-b border-[#F0F1F5] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-bold text-[#16181D]">
                    Revisão da minuta
                  </h2>
                  <span className="rounded-full bg-[#DFF2E7] px-2 py-0.5 font-mono text-[9px] font-bold text-[#1F6A47]">
                    {result.stats.percentualPreenchido}% preenchido
                  </span>
                </div>
                <p className="mt-1 text-[10.5px] text-[#767A86]">
                  {selectedCity?.name} · {selectedCity?.uf} · exercício {year}
                </p>
              </div>
              <div className="text-right">
                <div className="font-mono text-[16px] font-bold text-[#16181D]">
                  {result.stats.preenchidoAutomatico +
                    result.stats.preenchidoIA}
                  <span className="text-[10px] font-medium text-[#A2A6B2]">
                    /{result.stats.total}
                  </span>
                </div>
                <div className="text-[9px] text-[#A2A6B2]">
                  campos localizados
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {result.warnings.length > 0 && (
                <div className="mb-4 rounded-[14px] border border-[#F2DEAF] bg-[#FFF9EC] p-3">
                  <div className="flex items-center gap-2 text-[10.5px] font-bold text-[#8A5A00]">
                    <AlertTriangleIcon className="size-3.5" />
                    Confira os campos não localizados
                  </div>
                  <ul className="mt-2 space-y-1 pl-5 text-[10px] leading-relaxed text-[#7A642E]">
                    {result.warnings.slice(0, 3).map((warning) => (
                      <li key={warning} className="list-disc">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {REVIEW_FIELDS.map((field) => {
                  const value = String(result.contrato[field.key] ?? "");
                  const meta = result.metas.find(
                    (item) => item.campo === field.key,
                  );
                  return (
                    <Field key={field.key} label={field.label}>
                      <Input
                        value={value}
                        onChange={(event) =>
                          updateContractField(field.key, event.target.value)
                        }
                        placeholder={field.placeholder || "Não localizado"}
                        className={`h-9 rounded-[10px] bg-white text-[11.5px] ${
                          value
                            ? "border-[#E2E3E9]"
                            : "border-[#E7C2CB] bg-[#FFF9FA]"
                        }`}
                      />
                      <div className="mt-1 flex items-center gap-1.5 font-mono text-[8.5px] text-[#A2A6B2]">
                        <span
                          className={`size-1.5 rounded-full ${
                            value ? "bg-[#8FD3B6]" : "bg-[#F5A3B5]"
                          }`}
                        />
                        {value ? meta?.fonte || "revisado manualmente" : "revisão necessária"}
                      </div>
                    </Field>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[#F0F1F5] bg-[#FAFAFC] px-5 py-4">
              <label className="mb-3 flex cursor-pointer items-center gap-2.5 text-[10.5px] font-medium text-[#5A5E6A]">
                <input
                  type="checkbox"
                  checked={archive}
                  onChange={(event) => setArchive(event.target.checked)}
                  className="size-4 rounded accent-[#16181D]"
                />
                Salvar uma cópia do ZIP no acervo de {selectedCity?.name}
              </label>
              <Button
                type="button"
                onClick={generate}
                disabled={generating}
                className="h-11 w-full rounded-full bg-[#16181D] text-[12.5px] font-bold text-white hover:bg-[#2C2F38]"
              >
                {generating ? (
                  <>
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    Montando os documentos…
                  </>
                ) : (
                  <>
                    <DownloadIcon className="size-4" />
                    Gerar e baixar kit contratual
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold text-[#5A5E6A]">
        {label}
      </span>
      {children}
    </label>
  );
}
