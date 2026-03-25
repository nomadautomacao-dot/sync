"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSignature, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCompanies, useCompany } from "@/core/hooks/use-companies";
import type {
  EmpresaConfig,
  PropostaAutofillData,
  PropostaFormData,
  PropostaPublicValidationData,
  PropostaPublicValidationFieldKey,
} from "../types";
import { DEFAULT_PROPOSTA_FORM_DATA } from "../types";
import { triggerDocumentDownload } from "../utils/document-helpers";
import { authorityPreset, calculateHonorarios, getStateNameByUf } from "../utils/proposta-calculos";

const STEP_TITLES = ["Documento", "Ente", "Financeiro", "Download"] as const;

type OutputFormat = "docx" | "pdf" | "ambos";

interface MunicipioSuggestion {
  codigo_ibge: string;
  nome: string;
  uf: string;
  regiao: string;
}

interface MinimumWageInfo {
  value: number;
  effectiveDate: string;
  sourceLabel: string;
  sourceUrl: string;
  supportUrl?: string;
}

const PUBLIC_VALIDATION_FIELD_ORDER: PropostaPublicValidationFieldKey[] = [
  "cnpjMunicipio",
  "enderecoMunicipio",
  "cepMunicipio",
  "nomeFundoEducacao",
  "siglaFundoEducacao",
  "cnpjFundoEducacao",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatConfidence(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function getValidationStatusLabel(status: string) {
  if (status === "validated") {
    return "Validado";
  }

  if (status === "manual_only") {
    return "Manual";
  }

  return "Pendente";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/20 p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--sync-text-secondary)]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-[var(--sync-text-secondary)]">{hint}</div> : null}
    </div>
  );
}

export function PropostasWizard({ config }: { config?: EmpresaConfig }) {
  const { data: companies = [] } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const { data: fullSelectedCompany } = useCompany(selectedCompanyId);
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMinimumWage, setIsLoadingMinimumWage] = useState(false);
  const [minimumWageInfo, setMinimumWageInfo] = useState<MinimumWageInfo | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("docx");
  const [formData, setFormData] = useState<PropostaFormData>(DEFAULT_PROPOSTA_FORM_DATA);
  const [isSearchingMunicipio, setIsSearchingMunicipio] = useState(false);
  const [municipioSuggestions, setMunicipioSuggestions] = useState<MunicipioSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<MunicipioSuggestion | null>(null);
  const [isApplyingPrefill, setIsApplyingPrefill] = useState(false);
  const [prefillData, setPrefillData] = useState<PropostaAutofillData | null>(null);
  const [isValidatingPublicData, setIsValidatingPublicData] = useState(false);
  const [publicValidation, setPublicValidation] = useState<PropostaPublicValidationData | null>(null);

  useEffect(() => {
    setFormData((current) => {
      if (current.comarcaNome || !current.municipioNome) {
        return current;
      }

      return { ...current, comarcaNome: current.municipioNome };
    });
  }, [formData.municipioNome, formData.comarcaNome]);

  useEffect(() => {
    const query = formData.municipioNome.trim();
    const uf = formData.municipioUf.trim();

    if (query.length < 2) {
      setMunicipioSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearchingMunicipio(true);
        const response = await fetch(
          `/api/municipios/buscar?q=${encodeURIComponent(query)}${uf ? `&uf=${encodeURIComponent(uf)}` : ""}`,
          { signal: controller.signal, cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Falha ao buscar municípios.");
        }

        const payload = (await response.json()) as {
          success: boolean;
          data: MunicipioSuggestion[];
        };

        setMunicipioSuggestions(payload.data ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error(error);
          setMunicipioSuggestions([]);
        }
      } finally {
        setIsSearchingMunicipio(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [formData.municipioNome, formData.municipioUf]);

  const loadMinimumWage = async (applyToField = false) => {
    setIsLoadingMinimumWage(true);

    try {
      const response = await fetch("/api/reference/brazil-minimum-wage", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Falha ao consultar salário mínimo.");
      }

      const payload = (await response.json()) as MinimumWageInfo;
      setMinimumWageInfo(payload);

      if (applyToField) {
        setFormData((current) => ({
          ...current,
          escalonamento: {
            ...current.escalonamento,
            salarioMinimo: payload.value,
          },
        }));
        toast.success(`Salario minimo base atualizado para ${formatCurrency(payload.value)}.`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível buscar o salário mínimo vigente.");
    } finally {
      setIsLoadingMinimumWage(false);
    }
  };

  useEffect(() => {
    void loadMinimumWage(false);
  }, []);

  const calculated = useMemo(() => {
    return calculateHonorarios(formData);
  }, [formData]);

  const setField = <K extends keyof PropostaFormData>(key: K, value: PropostaFormData[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const setEscalonamento = (
    key: keyof PropostaFormData["escalonamento"],
    value: number,
  ) => {
    setFormData((current) => ({
      ...current,
      escalonamento: { ...current.escalonamento, [key]: value },
    }));
  };

  const applyAutofill = (payload: PropostaAutofillData) => {
    setFormData((current) => {
      const nextGender = payload.generoAutoridadeSugerido ?? current.generoAutoridade;
      const authority = authorityPreset(nextGender);

      return {
        ...current,
        codigoIbge: payload.codigoIbge,
        municipioNome: payload.municipioNome,
        municipioUf: payload.municipioUf,
        estadoNome: payload.estadoNome || getStateNameByUf(payload.municipioUf),
        comarcaNome: payload.comarcaNome || payload.municipioNome,
        generoAutoridade: nextGender,
        pronomeTratamento: payload.pronomeTratamento || authority.pronomeTratamento,
        tituloSocialAutoridade: payload.tituloSocialAutoridade || authority.tituloSocialAutoridade,
        cargoAutoridade: payload.cargoAutoridade || authority.cargoAutoridade,
        nomeAutoridade: payload.nomeAutoridade,
        partidoAutoridade: payload.partidoAutoridade,
        saudacaoInicial: payload.saudacaoInicial || authority.saudacaoInicial,
        orgaoExpedidorAutoridade:
          current.orgaoExpedidorAutoridade || `SSP/${payload.municipioUf}`,
        anoBase: payload.anoBase,
        anoProjetado: payload.anoProjetado,
        receitaAtual: payload.receitaAtual,
        receitaProjetada: payload.receitaProjetada,
        observacoesInternas: current.observacoesInternas,
      };
    });
    setPrefillData(payload);

    if (payload.publicValidation) {
      applyPublicValidation(payload.publicValidation);
    } else {
      setPublicValidation(null);
    }
  };

  const applyPublicValidation = (payload: PropostaPublicValidationData) => {
    setFormData((current) => {
      const shouldUseFundoEducacao =
        current.usarFundoEducacao ||
        Boolean(payload.fields.nomeFundoEducacao.value || payload.fields.cnpjFundoEducacao.value);

      return {
        ...current,
        cnpjMunicipio: payload.fields.cnpjMunicipio.value || current.cnpjMunicipio,
        enderecoMunicipio: payload.fields.enderecoMunicipio.value || current.enderecoMunicipio,
        cepMunicipio: payload.fields.cepMunicipio.value || current.cepMunicipio,
        usarFundoEducacao: shouldUseFundoEducacao,
        nomeFundoEducacao: payload.fields.nomeFundoEducacao.value || current.nomeFundoEducacao,
        siglaFundoEducacao: payload.fields.siglaFundoEducacao.value || current.siglaFundoEducacao,
        cnpjFundoEducacao: payload.fields.cnpjFundoEducacao.value || current.cnpjFundoEducacao,
      };
    });
    setPublicValidation(payload);
  };

  const handlePrefill = async (suggestion?: MunicipioSuggestion) => {
    setIsApplyingPrefill(true);

    try {
      const requestBody = suggestion
        ? { codigo_ibge: suggestion.codigo_ibge }
        : formData.codigoIbge
          ? { codigo_ibge: formData.codigoIbge }
          : { nome: formData.municipioNome, uf: formData.municipioUf };

      const response = await fetch("/api/propostas/prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error || "Falha ao carregar dados oficiais do município.");
      }

      const payload = (await response.json()) as { success: true; data: PropostaAutofillData };
      applyAutofill(payload.data);
      setSelectedSuggestion(suggestion ?? null);
      toast.success(`Dados oficiais carregados para ${payload.data.municipioNome}/${payload.data.municipioUf}.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Não foi possível autopreencher a proposta com os dados oficiais.");
    } finally {
      setIsApplyingPrefill(false);
    }
  };

  const handleValidatePublicData = async (suggestion?: MunicipioSuggestion) => {
    setIsValidatingPublicData(true);

    try {
      const requestBody = suggestion
        ? { codigo_ibge: suggestion.codigo_ibge }
        : formData.codigoIbge
          ? { codigo_ibge: formData.codigoIbge }
          : { nome: formData.municipioNome, uf: formData.municipioUf };

      const response = await fetch("/api/propostas/validate-public-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error || "Falha ao validar os dados públicos do município.");
      }

      const payload = (await response.json()) as { success: true; data: PropostaPublicValidationData };
      applyPublicValidation(payload.data);
      toast.success(`Dados públicos validados para ${payload.data.municipioNome}/${payload.data.municipioUf}.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Não foi possível validar os dados públicos com a IA.");
    } finally {
      setIsValidatingPublicData(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const scopes =
        formData.escopoDocumento === "ambos"
          ? ["proposta", "minuta"] as const
          : [formData.escopoDocumento] as const;

      for (const scope of scopes) {
        if (outputFormat === "docx" || outputFormat === "ambos") {
          if (scope === "proposta") {
            const { generatePropostaDocx } = await import("../utils/generate-proposta-docx");
            const file = await generatePropostaDocx(formData, config, fullSelectedCompany);
            triggerDocumentDownload(file.blob, file.fileName);
          } else {
            const { generateMinutaDocx } = await import("../utils/generate-minuta-docx");
            const file = await generateMinutaDocx(formData, config, fullSelectedCompany);
            triggerDocumentDownload(file.blob, file.fileName);
          }
        }

        if (outputFormat === "pdf" || outputFormat === "ambos") {
          if (scope === "proposta") {
            const { generatePropostaPdf } = await import("../utils/generate-proposta-pdf");
            const file = await generatePropostaPdf(formData, config, fullSelectedCompany);
            triggerDocumentDownload(file.blob, file.fileName);
          } else {
            const { generateMinutaPdf } = await import("../utils/generate-minuta-pdf");
            const file = await generateMinutaPdf(formData, config, fullSelectedCompany);
            triggerDocumentDownload(file.blob, file.fileName);
          }
        }
      }

      toast.success("Documento(s) gerado(s) com sucesso.");
    } catch (error) {
      console.error(error);
      toast.error("Falha ao gerar os arquivos selecionados.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="mx-auto max-w-6xl border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] shadow-xl">
      <CardHeader className="border-b border-[var(--sync-border-subtle)]">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold">
          <FileSignature className="h-6 w-6 text-[var(--sync-accent)]" />
          Wizard de Proposta e Minuta
        </CardTitle>
        <p className="text-sm text-[var(--sync-text-secondary)]">
          Passo {step} de {STEP_TITLES.length}: {STEP_TITLES[step - 1]}
        </p>
      </CardHeader>

      <CardContent className="space-y-8 p-8">
        {step === 1 ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Saída desejada">
              <select
                className="flex h-11 w-full rounded-md border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
                value={formData.escopoDocumento}
                onChange={(event) =>
                  setField("escopoDocumento", event.target.value as PropostaFormData["escopoDocumento"])
                }
              >
                <option value="ambos">Proposta + Minuta</option>
                <option value="proposta">Somente proposta</option>
                <option value="minuta">Somente minuta</option>
              </select>
            </Field>

            <Field label="Empresa emissora">
              <select
                className="flex h-11 w-full rounded-md border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
                value={selectedCompanyId}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
              >
                <option value="">Configuração global</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.tradingName || company.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="rounded-xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/20 p-4 text-sm text-[var(--sync-text-secondary)] md:col-span-2">
              <p>Mapa de campos identificado nos 8 documentos:</p>
              <p>
                Município, autoridade, CNPJ/endereço, comarca, bloco opcional do FME, anos e
                receitas, salário mínimo do escalonamento, número do contrato, inexigibilidade,
                processo, vigência e secretarias.
              </p>
              <p>
                Normalizações obrigatórias: Exmo./Exma., Prefeito/Prefeita,
                residente/domiciliado(a) e foro separado do nome do município.
              </p>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/20 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
                <Field label="Município para autopreenchimento">
                  <Input
                    value={formData.municipioNome}
                    onChange={(event) => {
                      setSelectedSuggestion(null);
                      setPublicValidation(null);
                      setField("municipioNome", event.target.value);
                    }}
                    placeholder="Digite o nome oficial do município"
                  />
                </Field>

                <Field label="UF">
                  <Input
                    value={formData.municipioUf}
                    maxLength={2}
                    onChange={(event) => {
                      setSelectedSuggestion(null);
                      setPublicValidation(null);
                      setField("municipioUf", event.target.value.toUpperCase());
                    }}
                    placeholder="UF"
                  />
                </Field>

                <div className="flex flex-col gap-3 xl:min-w-72">
                  <Button
                    type="button"
                    className="h-11"
                    disabled={isApplyingPrefill || (!formData.codigoIbge && !formData.municipioNome.trim())}
                    onClick={() => void handlePrefill(selectedSuggestion ?? undefined)}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {isApplyingPrefill ? "Carregando dados oficiais..." : "Autopreencher dados oficiais"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={isValidatingPublicData || (!formData.codigoIbge && !formData.municipioNome.trim())}
                    onClick={() => void handleValidatePublicData(selectedSuggestion ?? undefined)}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {isValidatingPublicData ? "Validando na web..." : "Validar dados públicos com IA"}
                  </Button>
                </div>
              </div>

              {isSearchingMunicipio ? (
                <div className="mt-3 text-xs text-[var(--sync-text-secondary)]">Buscando municípios...</div>
              ) : null}

              {municipioSuggestions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {municipioSuggestions.slice(0, 8).map((item) => (
                    <button
                      key={item.codigo_ibge}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        selectedSuggestion?.codigo_ibge === item.codigo_ibge
                          ? "border-[var(--sync-accent)] bg-[var(--sync-accent)]/10 text-white"
                          : "border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] text-[var(--sync-text-secondary)]"
                      }`}
                      onClick={() => {
                        setSelectedSuggestion(item);
                        setPublicValidation(null);
                        setFormData((current) => ({
                          ...current,
                          codigoIbge: item.codigo_ibge,
                          municipioNome: item.nome,
                          municipioUf: item.uf,
                          estadoNome: getStateNameByUf(item.uf),
                        }));
                        void handlePrefill(item);
                      }}
                    >
                      {item.nome}/{item.uf} · IBGE {item.codigo_ibge}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 rounded-lg border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)]/60 p-4 text-sm text-[var(--sync-text-secondary)]">
                {prefillData ? (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <p>
                      IBGE: <span className="font-semibold text-white">{prefillData.codigoIbge}</span>
                    </p>
                    <p>
                      Prefeito(a): <span className="font-semibold text-white">{prefillData.nomeAutoridade}</span>
                    </p>
                    <p>
                      Partido: <span className="font-semibold text-white">{prefillData.partidoAutoridade || "Não informado"}</span>
                    </p>
                    <p>
                      Receita base: <span className="font-semibold text-white">{formatCurrency(prefillData.receitaAtual)}</span>
                    </p>
                    <p>
                      Receita projetada: <span className="font-semibold text-white">{formatCurrency(prefillData.receitaProjetada)}</span>
                    </p>
                    <p>
                      Ano base/projetado: <span className="font-semibold text-white">{prefillData.anoBase} → {prefillData.anoProjetado}</span>
                    </p>
                    <p className="md:col-span-2 xl:col-span-2">
                      Pendências manuais:{" "}
                      <span className="font-semibold text-white">
                        {prefillData.camposPendentes.join(", ")}
                      </span>
                    </p>
                    {prefillData.publicValidationSource === "history" ? (
                      <p className="md:col-span-2 xl:col-span-2">
                        Histórico institucional:{" "}
                        <span className="font-semibold text-white">
                          validacao publica reaproveitada automaticamente para este municipio
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p>
                    Use o autopreenchimento para trazer nome oficial do município, código IBGE,
                    prefeito, partido e a base financeira do FUNDEB já consolidada no sistema.
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)]/60 p-4 text-sm text-[var(--sync-text-secondary)]">
                {publicValidation ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="font-medium text-white">Validação pública com IA</p>
                        <p>{publicValidation.summary}</p>
                      </div>
                      <div className="text-xs">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(publicValidation.validatedAt))}
                        {" · "}
                        {publicValidation.model}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {PUBLIC_VALIDATION_FIELD_ORDER.map((fieldKey) => {
                        const field = publicValidation.fields[fieldKey];
                        return (
                          <div
                            key={fieldKey}
                            className="rounded-xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/20 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-xs uppercase tracking-wide text-[var(--sync-text-secondary)]">
                                {field.label}
                              </div>
                              <div className="text-xs font-medium text-white">
                                {getValidationStatusLabel(field.status)}
                              </div>
                            </div>
                            <div className="mt-2 text-sm font-semibold text-white">
                              {field.value || "Pendente manual"}
                            </div>
                            <div className="mt-2 text-xs text-[var(--sync-text-secondary)]">
                              Confiança: <span className="font-medium text-white">{formatConfidence(field.confidence)}</span>
                            </div>
                            {field.notes ? (
                              <div className="mt-2 text-xs text-[var(--sync-text-secondary)]">{field.notes}</div>
                            ) : null}
                            {field.sourceUrl ? (
                              <a
                                href={field.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex text-xs font-medium text-[var(--sync-accent)] underline-offset-4 hover:underline"
                              >
                                {field.sourceLabel || "Abrir fonte"}
                              </a>
                            ) : (
                              <div className="mt-3 text-xs text-[var(--sync-text-secondary)]">
                                Sem fonte publica forte nesta rodada.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <p>
                        Pendências manuais:{" "}
                        <span className="font-semibold text-white">
                          {publicValidation.pendingManual.join(", ")}
                        </span>
                      </p>
                      {publicValidation.searchQueries.length > 0 ? (
                        <p>
                          Buscas usadas:{" "}
                          <span className="font-semibold text-white">
                            {publicValidation.searchQueries.slice(0, 3).join(" | ")}
                          </span>
                        </p>
                      ) : null}
                    </div>

                    {publicValidation.warnings.length > 0 ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                        {publicValidation.warnings.join(" ")}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p>
                    Use a validação pública com IA para conferir CNPJ, endereço, CEP e fundo de educação com fonte, link e confiança. CPF e RG do prefeito permanecem manuais.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Município">
              <Input
                value={formData.municipioNome}
                onChange={(event) => setField("municipioNome", event.target.value)}
              />
            </Field>
            <Field label="Código IBGE">
              <Input
                value={formData.codigoIbge}
                onChange={(event) => setField("codigoIbge", event.target.value)}
              />
            </Field>
            <Field label="UF">
              <Input
                value={formData.municipioUf}
                maxLength={2}
                onChange={(event) => setField("municipioUf", event.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Estado por extenso">
              <Input
                value={formData.estadoNome}
                onChange={(event) => setField("estadoNome", event.target.value)}
              />
            </Field>
            <Field label="Comarca">
              <Input
                value={formData.comarcaNome}
                onChange={(event) => setField("comarcaNome", event.target.value)}
              />
            </Field>
            <Field label="Título do destinatário">
              <Input
                value={formData.destinatarioTitulo}
                onChange={(event) => setField("destinatarioTitulo", event.target.value)}
              />
            </Field>
            <Field label="CNPJ do município">
              <Input
                value={formData.cnpjMunicipio}
                onChange={(event) => setField("cnpjMunicipio", event.target.value)}
              />
            </Field>
            <Field label="Endereço institucional">
              <Input
                value={formData.enderecoMunicipio}
                onChange={(event) => setField("enderecoMunicipio", event.target.value)}
              />
            </Field>
            <Field label="CEP">
              <Input
                value={formData.cepMunicipio}
                onChange={(event) => setField("cepMunicipio", event.target.value)}
              />
            </Field>
            <Field label="Gênero da autoridade">
              <select
                className="flex h-11 w-full rounded-md border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
                value={formData.generoAutoridade}
                onChange={(event) => {
                  const genero = event.target.value as PropostaFormData["generoAutoridade"];
                  const preset = authorityPreset(genero);
                  setFormData((current) => ({ ...current, generoAutoridade: genero, ...preset }));
                }}
              >
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </Field>
            <Field label="Pronome">
              <Input
                value={formData.pronomeTratamento}
                onChange={(event) => setField("pronomeTratamento", event.target.value)}
              />
            </Field>
            <Field label="Título social">
              <Input
                value={formData.tituloSocialAutoridade}
                onChange={(event) => setField("tituloSocialAutoridade", event.target.value)}
              />
            </Field>
            <Field label="Cargo">
              <Input
                value={formData.cargoAutoridade}
                onChange={(event) => setField("cargoAutoridade", event.target.value)}
              />
            </Field>
            <Field label="Nome da autoridade">
              <Input
                value={formData.nomeAutoridade}
                onChange={(event) => setField("nomeAutoridade", event.target.value)}
              />
            </Field>
            <Field label="Partido da autoridade">
              <Input
                value={formData.partidoAutoridade}
                onChange={(event) => setField("partidoAutoridade", event.target.value)}
              />
            </Field>
            <Field label="Saudação inicial">
              <Input
                value={formData.saudacaoInicial}
                onChange={(event) => setField("saudacaoInicial", event.target.value)}
              />
            </Field>
            <Field label="RG">
              <Input
                value={formData.rgAutoridade}
                onChange={(event) => setField("rgAutoridade", event.target.value)}
              />
            </Field>
            <Field label="Órgão expedidor">
              <Input
                value={formData.orgaoExpedidorAutoridade}
                onChange={(event) => setField("orgaoExpedidorAutoridade", event.target.value)}
              />
            </Field>
            <Field label="CPF">
              <Input
                value={formData.cpfAutoridade}
                onChange={(event) => setField("cpfAutoridade", event.target.value)}
              />
            </Field>
            <label className="flex items-center gap-3 text-sm font-medium xl:col-span-3">
              <input
                type="checkbox"
                checked={formData.usarFundoEducacao}
                onChange={(event) => setField("usarFundoEducacao", event.target.checked)}
              />
              Incluir fundo municipal de educação na minuta
            </label>
            {formData.usarFundoEducacao ? (
              <>
                <Field label="Nome do fundo">
                  <Input
                    value={formData.nomeFundoEducacao}
                    onChange={(event) => setField("nomeFundoEducacao", event.target.value)}
                  />
                </Field>
                <Field label="Sigla">
                  <Input
                    value={formData.siglaFundoEducacao}
                    onChange={(event) => setField("siglaFundoEducacao", event.target.value)}
                  />
                </Field>
                <Field label="CNPJ do fundo">
                  <Input
                    value={formData.cnpjFundoEducacao}
                    onChange={(event) => setField("cnpjFundoEducacao", event.target.value)}
                  />
                </Field>
              </>
            ) : null}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            {prefillData ? (
              <div className="rounded-xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/20 p-4 text-sm text-[var(--sync-text-secondary)]">
                <p className="font-medium text-white">Base financeira autopreenchida pelo levantamento FUNDEB</p>
                <p className="mt-1">
                  Receita atual {formatCurrency(prefillData.receitaAtual)} e receita projetada {formatCurrency(prefillData.receitaProjetada)} para {prefillData.anoBase} → {prefillData.anoProjetado}.
                </p>
                <p className="mt-1">
                  Fonte consolidada: <span className="font-semibold text-white">{prefillData.fonteReceita}</span>
                </p>
              </div>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Ano base">
                <Input
                  type="number"
                  value={formData.anoBase}
                  onChange={(event) => setField("anoBase", Number(event.target.value))}
                />
              </Field>
              <Field label="Ano projetado">
                <Input
                  type="number"
                  value={formData.anoProjetado}
                  onChange={(event) => setField("anoProjetado", Number(event.target.value))}
                />
              </Field>
              <Field label="Receita atual">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.receitaAtual}
                  onChange={(event) => setField("receitaAtual", Number(event.target.value))}
                />
              </Field>
              <Field label="Receita projetada">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.receitaProjetada}
                  onChange={(event) => setField("receitaProjetada", Number(event.target.value))}
                />
              </Field>

              <div className="space-y-2 xl:col-span-4">
                <div className="flex flex-col gap-3 rounded-xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/20 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Salario minimo base do Brasil</div>
                    <div className="mt-1 text-xs text-[var(--sync-text-secondary)]">
                      {minimumWageInfo
                        ? `Referencia oficial: ${formatCurrency(minimumWageInfo.value)} desde ${formatDate(minimumWageInfo.effectiveDate)}`
                        : "Clique para consultar a referencia oficial vigente."}
                    </div>
                    {minimumWageInfo ? (
                      <div className="mt-2 text-xs text-[var(--sync-text-secondary)]">
                        Fonte:{" "}
                        <a
                          className="text-[var(--sync-accent)] underline"
                          href={minimumWageInfo.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {minimumWageInfo.sourceLabel}
                        </a>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isLoadingMinimumWage}
                      onClick={() => void loadMinimumWage(false)}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      Buscar referencia
                    </Button>
                    <Button
                      type="button"
                      disabled={isLoadingMinimumWage}
                      onClick={() => void loadMinimumWage(true)}
                    >
                      Usar valor oficial
                    </Button>
                  </div>
                </div>
              </div>

              <Field label="Salário mínimo">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.escalonamento.salarioMinimo}
                  onChange={(event) =>
                    setEscalonamento("salarioMinimo", Number(event.target.value))
                  }
                />
              </Field>
              <Field label="Limite nivel I (SM)">
                <Input
                  type="number"
                  value={formData.escalonamento.nivel1LimiteSm}
                  onChange={(event) =>
                    setEscalonamento("nivel1LimiteSm", Number(event.target.value))
                  }
                />
              </Field>
              <Field label="% nivel I">
                <Input
                  type="number"
                  value={formData.escalonamento.nivel1Percentual}
                  onChange={(event) =>
                    setEscalonamento("nivel1Percentual", Number(event.target.value))
                  }
                />
              </Field>
              <Field label="Limite nivel II (SM)">
                <Input
                  type="number"
                  value={formData.escalonamento.nivel2LimiteSm}
                  onChange={(event) =>
                    setEscalonamento("nivel2LimiteSm", Number(event.target.value))
                  }
                />
              </Field>
              <Field label="% nivel II">
                <Input
                  type="number"
                  value={formData.escalonamento.nivel2Percentual}
                  onChange={(event) =>
                    setEscalonamento("nivel2Percentual", Number(event.target.value))
                  }
                />
              </Field>
              <Field label="% nivel III">
                <Input
                  type="number"
                  value={formData.escalonamento.nivel3Percentual}
                  onChange={(event) =>
                    setEscalonamento("nivel3Percentual", Number(event.target.value))
                  }
                />
              </Field>
              <Field label="Número do contrato">
                <Input
                  value={formData.contratoNumero}
                  onChange={(event) => setField("contratoNumero", event.target.value)}
                />
              </Field>
              <Field label="Inexigibilidade">
                <Input
                  value={formData.inexigibilidadeNumero}
                  onChange={(event) => setField("inexigibilidadeNumero", event.target.value)}
                />
              </Field>
              <Field label="Processo administrativo">
                <Input
                  value={formData.processoAdministrativoNumero}
                  onChange={(event) =>
                    setField("processoAdministrativoNumero", event.target.value)
                  }
                />
              </Field>
              <Field label="Data do documento">
                <Input
                  type="date"
                  value={formData.dataDocumento}
                  onChange={(event) => setField("dataDocumento", event.target.value)}
                />
              </Field>
              <Field label="Fim da vigência">
                <Input
                  type="date"
                  value={formData.vigenciaEncerramento}
                  onChange={(event) => setField("vigenciaEncerramento", event.target.value)}
                />
              </Field>
              <Field label="Prazo da proposta (meses)">
                <Input
                  type="number"
                  value={formData.prazoVigenciaMeses}
                  onChange={(event) =>
                    setField("prazoVigenciaMeses", Number(event.target.value))
                  }
                />
              </Field>
              <Field label="Validade da proposta (dias)">
                <Input
                  type="number"
                  value={formData.prazoValidadePropostaDias}
                  onChange={(event) =>
                    setField("prazoValidadePropostaDias", Number(event.target.value))
                  }
                />
              </Field>
              <Field label="Secretaria de acompanhamento">
                <Input
                  value={formData.secretariaAcompanhamento}
                  onChange={(event) =>
                    setField("secretariaAcompanhamento", event.target.value)
                  }
                />
              </Field>
              <Field label="Secretaria de fiscalização">
                <Input
                  value={formData.secretariaFiscalizacao}
                  onChange={(event) =>
                    setField("secretariaFiscalizacao", event.target.value)
                  }
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Receita atual em salarios minimos"
                value={`${formatNumber(calculated.receitaAtualSm)} SM`}
                hint={formatCurrency(formData.receitaAtual)}
              />
              <MetricCard
                label="Receita projetada em salarios minimos"
                value={`${formatNumber(calculated.receitaProjetadaSm)} SM`}
                hint={formatCurrency(formData.receitaProjetada)}
              />
              <MetricCard
                label="Incremento estimado em salarios minimos"
                value={`${formatNumber(calculated.incrementoSm)} SM`}
                hint={formatCurrency(calculated.incremento)}
              />
              <MetricCard
                label="Honorarios estimados em salarios minimos"
                value={`${formatNumber(calculated.honorariosSm)} SM`}
                hint={formatCurrency(calculated.honorarios)}
              />
              <MetricCard
                label="Faixa nivel I convertida em reais"
                value={formatCurrency(calculated.nivel1Brl)}
                hint={`${formData.escalonamento.nivel1LimiteSm} SM`}
              />
              <MetricCard
                label="Faixa nivel II convertida em reais"
                value={formatCurrency(calculated.nivel2Brl)}
                hint={`${formData.escalonamento.nivel2LimiteSm} SM`}
              />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/20 p-5 text-sm text-[var(--sync-text-secondary)]">
              <p>
                Município:{" "}
                <span className="font-semibold text-white">
                  {formData.municipioNome || "Não informado"} / {formData.municipioUf}
                </span>
              </p>
              <p>
                Autoridade:{" "}
                <span className="font-semibold text-white">
                  {formData.cargoAutoridade} - {formData.nomeAutoridade || "Não informado"}
                </span>
              </p>
              <p>
                Código IBGE: <span className="font-semibold text-white">{formData.codigoIbge || "Não informado"}</span>
              </p>
              <p>
                Partido: <span className="font-semibold text-white">{formData.partidoAutoridade || "Não informado"}</span>
              </p>
              <p>
                Incremento estimado:{" "}
                <span className="font-semibold text-emerald-400">
                  {formatCurrency(calculated.incremento)}
                </span>
              </p>
              <p>
                Incremento em SM:{" "}
                <span className="font-semibold text-white">
                  {formatNumber(calculated.incrementoSm)} SM
                </span>
              </p>
              <p>
                Honorarios estimados:{" "}
                <span className="font-semibold text-white">
                  {formatCurrency(calculated.honorarios)}
                </span>
              </p>
              <p>
                Escopo: <span className="font-semibold text-white">{formData.escopoDocumento}</span>
              </p>
            </div>

            <div className="space-y-4">
              <Field label="Formato final">
                <select
                  className="flex h-11 w-full rounded-md border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
                  value={outputFormat}
                  onChange={(event) => setOutputFormat(event.target.value as OutputFormat)}
                >
                  <option value="docx">DOCX</option>
                  <option value="pdf">PDF</option>
                  <option value="ambos">DOCX + PDF</option>
                </select>
              </Field>

              <div className="rounded-xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/20 p-4 text-sm text-[var(--sync-text-secondary)]">
                {minimumWageInfo ? (
                  <p>
                    Base oficial usada como referencia: {formatCurrency(minimumWageInfo.value)} desde{" "}
                    {formatDate(minimumWageInfo.effectiveDate)}.
                  </p>
                ) : (
                  <p>Referência oficial do salário mínimo ainda não carregada.</p>
                )}
              </div>

              <Button className="h-11 w-full" disabled={isGenerating} onClick={handleGenerate}>
                Gerar arquivos conforme seleção final
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-[var(--sync-border-subtle)] pt-6">
          <Button
            variant="outline"
            disabled={step === 1}
            onClick={() => setStep((current) => current - 1)}
          >
            Anterior
          </Button>
          {step < STEP_TITLES.length ? (
            <Button onClick={() => setStep((current) => current + 1)}>Próximo passo</Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
