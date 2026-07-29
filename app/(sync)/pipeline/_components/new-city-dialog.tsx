"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  SearchIcon,
  SparklesIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  XIcon,
  Building2Icon,
  MapPinIcon,
  LoaderIcon,
} from "lucide-react";

import type { CityAccount, StageKey } from "@/core/lib/city-types";
import { STAGE_LABELS, BOARD_STAGES } from "@/core/lib/city-types";
import { searchMunicipios, preloadMunicipios, type IbgeMunicipio } from "@/core/lib/ibge-client";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Badge } from "@/core/components/ui/badge";

interface NewCityDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<CityAccount> & { name: string; uf: string }) => Promise<void>;
  context?: "pipeline" | "cities";
}

const CREATION_STAGES: StageKey[] = [
  ...BOARD_STAGES,
  "institutional_validation",
];

export function NewCityDialog({
  open,
  onClose,
  onSubmit,
  context = "pipeline",
}: NewCityDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<IbgeMunicipio[]>([]);
  const [selected, setSelected] = useState<IbgeMunicipio | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeResult, setActiveResult] = useState(-1);
  const [stage, setStage] = useState<StageKey>("mapping");
  const [revenue, setRevenue] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      preloadMunicipios();
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  // Busca IBGE
  useEffect(() => {
    let cancelled = false;
    if (search.trim().length >= 2 && !selected) {
      searchMunicipios(search)
        .then((res) => {
          if (cancelled) return;
          setResults(res);
          setActiveResult(res.length ? 0 : -1);
        })
        .catch((error) => {
          if (cancelled) return;
          setResults([]);
          setActiveResult(-1);
          setSearchError(
            error instanceof Error
              ? error.message
              : "Não foi possível consultar a base IBGE.",
          );
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [search, selected]);

  const handleSelect = (m: IbgeMunicipio) => {
    setSelected(m);
    setSearch(`${m.nome} (${m.uf})`);
    setResults([]);
    setActiveResult(-1);
    setSearchError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: selected.nome,
        uf: selected.uf,
        codigoIbge: selected.codigoIbge,
        region: selected.regiao,
        stage,
        estimatedAnnualRevenue: revenue ? parseFloat(revenue) : 0,
        nextStepDescription: nextStep.trim() || undefined,
      });
      reset();
    } catch {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSearch("");
    setResults([]);
    setSelected(null);
    setSearching(false);
    setSearchError("");
    setActiveResult(-1);
    setStage("mapping");
    setRevenue("");
    setNextStep("");
    setSubmitting(false);
    onClose();
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] max-w-[540px] overflow-hidden rounded-2xl border border-white/95 bg-white/[.88] p-0 shadow-[0_10px_26px_rgba(22,24,29,.05)] backdrop:bg-[#16181D]/40 backdrop:backdrop-blur-sm"
      onClose={reset}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[calc(100dvh-32px)] flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0F1F5] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#F2F1F7] text-[#16181D]">
              <Building2Icon className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-[#16181D]">
                {context === "cities"
                  ? "Adicionar cidade à carteira"
                  : "Adicionar município ao pipeline"}
              </h2>
              <p className="text-xs font-medium text-[#767A86]">
                Busque e selecione o município na base oficial do IBGE
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={reset}
            aria-label="Fechar cadastro de município"
            className="flex size-8 items-center justify-center rounded-lg text-[#A2A6B2] transition-colors hover:bg-[#F2F1F7] hover:text-[#3B3F4A]"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Integração entre carteira, relatórios e pipeline */}
        <div className="bg-gradient-to-r from-[#F7F6FA] via-[#F7F6FA]/50 to-white px-6 py-2.5 border-b border-[#F0F1F5]/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#3B3F4A] font-medium">
            <SparklesIcon className="size-4 text-[#16181D] shrink-0" />
            <span>
              {context === "cities"
                ? "Relatórios e dados FUNDEB serão vinculados pelo código IBGE"
                : "Precisa criar o relatório primeiro?"}
            </span>
          </div>
          {context === "pipeline" && (
            <Button asChild variant="outline" size="sm" className="h-7 text-xs font-bold border-[#F0F1F5] text-[#16181D] rounded-full hover:bg-[#F2F1F7]">
              <Link href="/modulos">
                Aba de Relatórios <ArrowRightIcon className="ml-1 size-3" />
              </Link>
            </Button>
          )}
        </div>

        {/* Body */}
        <div className="space-y-4 overflow-y-auto px-6 py-5">
          {/* Autocomplete IBGE */}
          <div className="relative space-y-1.5">
            <Label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#3B3F4A]">
              SELECIONAR MUNICÍPIO (BASE OFICIAL IBGE)
            </Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#A2A6B2]" />
              <Input
                type="text"
                value={search}
                onChange={(e) => {
                  const nextSearch = e.target.value;
                  setSearch(nextSearch);
                  setSearchError("");
                  setActiveResult(-1);
                  if (nextSearch.trim().length < 2) {
                    setResults([]);
                    setSearching(false);
                  } else {
                    setSearching(true);
                  }
                  if (selected) setSelected(null);
                }}
                onKeyDown={(event) => {
                  if (!results.length) {
                    if (event.key === "Escape") setResults([]);
                    return;
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveResult((current) =>
                      Math.min(current + 1, results.length - 1),
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveResult((current) => Math.max(current - 1, 0));
                  } else if (event.key === "Enter" && activeResult >= 0) {
                    event.preventDefault();
                    handleSelect(results[activeResult]);
                  } else if (event.key === "Escape") {
                    setResults([]);
                    setActiveResult(-1);
                  }
                }}
                placeholder="Busque por nome do município (ex: Inhapi, Palmeira dos Índios)..."
                className="h-11 rounded-full border-[#F0F1F5] bg-[#F7F6FA]/50 pl-10 text-xs font-semibold text-[#16181D] placeholder:text-[#A2A6B2] focus:border-[#16181D] focus:bg-white"
                autoFocus
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={results.length > 0}
                aria-controls="new-city-results"
                aria-activedescendant={
                  activeResult >= 0
                    ? `new-city-result-${results[activeResult]?.codigoIbge}`
                    : undefined
                }
                aria-busy={searching}
              />
            </div>

            {/* Resultados do Autocomplete */}
            {results.length > 0 && !selected && (
              <div
                id="new-city-results"
                role="listbox"
                className="absolute left-0 top-full z-50 mt-1 max-h-[220px] w-full overflow-y-auto rounded-xl border border-[#F0F1F5] bg-white shadow-xl"
              >
                {results.map((m, index) => (
                  <button
                    key={m.codigoIbge}
                    id={`new-city-result-${m.codigoIbge}`}
                    role="option"
                    aria-selected={activeResult === index}
                    type="button"
                    onClick={() => handleSelect(m)}
                    onMouseEnter={() => setActiveResult(index)}
                    className="flex w-full items-center justify-between border-b border-[#F0F1F5] px-4 py-2.5 text-left transition-colors last:border-none hover:bg-[#F7F6FA] aria-selected:bg-[#F2F1F7]"
                  >
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="size-3.5 text-[#16181D]" />
                      <span className="text-xs font-bold text-[#16181D]">{m.nome}</span>
                      <Badge variant="outline" className="font-mono text-[10px] border-[#F0F1F5] text-[#5A5E6A]">
                        {m.uf}
                      </Badge>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-[#767A86]">
                      IBGE {m.codigoIbge}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {searchError && (
              <p role="alert" className="text-[11px] font-medium text-[#A33D56]">
                {searchError}
              </p>
            )}

            {/* Confirmação de Seleção */}
            {selected && (
              <div className="flex items-center gap-2 rounded-xl border border-[#F0F1F5] bg-[#F2F1F7]/60 p-2.5 text-xs text-[#16181D] font-medium">
                <CheckCircle2Icon className="size-4 shrink-0 text-[#16181D]" />
                <span>
                  <strong>{selected.nome}/{selected.uf}</strong> · IBGE {selected.codigoIbge} · Região {selected.regiao}
                </span>
              </div>
            )}
          </div>

          {/* Estágio Inicial */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#3B3F4A]">
              ESTÁGIO INICIAL NO PIPELINE
            </Label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as StageKey)}
              className="h-11 w-full rounded-full border border-[#F0F1F5] bg-[#F7F6FA]/50 px-3.5 text-xs font-semibold text-[#16181D] outline-none focus:border-[#16181D] focus:bg-white"
            >
              {CREATION_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Receita Estimada Anual */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#3B3F4A]">
              RECEITA ANUAL ESTIMADA FUNDEB (R$)
            </Label>
            <Input
              type="number"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              placeholder={
                context === "cities"
                  ? "Opcional — o levantamento preencherá quando disponível"
                  : "Ex: 1250000"
              }
              min="0"
              step="1000"
              className="h-11 rounded-full border-[#F0F1F5] bg-[#F7F6FA]/50 font-mono text-xs font-bold text-[#16181D] focus:border-[#16181D] focus:bg-white"
            />
          </div>

          {/* Próximo Passo */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#3B3F4A]">
              PRÓXIMO PASSO COMERCIAL
            </Label>
            <Input
              type="text"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="Ex: Agendar apresentação executiva com prefeito"
              className="h-11 rounded-full border-[#F0F1F5] bg-[#F7F6FA]/50 text-xs font-semibold text-[#16181D] focus:border-[#16181D] focus:bg-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#F0F1F5] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            className="h-10 rounded-full text-xs font-semibold text-[#3B3F4A] border-[#F0F1F5]"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!selected || submitting}
            className="h-10 rounded-full bg-[#16181D] text-xs font-bold text-white hover:bg-[#2C2F38] disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <LoaderIcon className="size-4 animate-spin" />
                Salvando…
              </span>
            ) : (
              context === "cities" ? "Adicionar e abrir cidade" : "Adicionar ao pipeline"
            )}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
