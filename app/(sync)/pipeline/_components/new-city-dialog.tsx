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
}

const CREATION_STAGES: StageKey[] = [
  ...BOARD_STAGES,
  "institutional_validation",
];

export function NewCityDialog({ open, onClose, onSubmit }: NewCityDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<IbgeMunicipio[]>([]);
  const [selected, setSelected] = useState<IbgeMunicipio | null>(null);
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
      searchMunicipios(search).then((res) => {
        if (!cancelled) setResults(res);
      });
    } else {
      setResults([]);
    }
    return () => {
      cancelled = true;
    };
  }, [search, selected]);

  const handleSelect = (m: IbgeMunicipio) => {
    setSelected(m);
    setSearch(`${m.nome} (${m.uf})`);
    setResults([]);
    if (!revenue) {
      setRevenue("1250000");
    }
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
      className="fixed inset-0 m-auto h-fit w-full max-w-[540px] rounded-2xl border border-white/95 bg-white/[.88] p-0 shadow-[0_10px_26px_rgba(22,24,29,.05)] backdrop:bg-[#16181D]/40 backdrop:backdrop-blur-sm"
      onClose={reset}
    >
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0F1F5] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#F2F1F7] text-[#16181D]">
              <Building2Icon className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-[#16181D]">
                Adicionar Município ao Pipeline
              </h2>
              <p className="text-xs font-medium text-[#767A86]">
                Selecione o município a partir da base predefinida IBGE
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={reset}
            className="flex size-8 items-center justify-center rounded-lg text-[#A2A6B2] transition-colors hover:bg-[#F2F1F7] hover:text-[#3B3F4A]"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Banner para Gerador de Relatórios */}
        <div className="bg-gradient-to-r from-[#F7F6FA] via-[#F7F6FA]/50 to-white px-6 py-2.5 border-b border-[#F0F1F5]/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#3B3F4A] font-medium">
            <SparklesIcon className="size-4 text-[#16181D] shrink-0" />
            <span>Precisa criar o relatório primeiro?</span>
          </div>
          <Button asChild variant="outline" size="sm" className="h-7 text-xs font-bold border-[#F0F1F5] text-[#16181D] rounded-full hover:bg-[#F2F1F7]">
            <Link href="/modulos">
              Aba de Relatórios <ArrowRightIcon className="ml-1 size-3" />
            </Link>
          </Button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
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
                  setSearch(e.target.value);
                  if (selected) setSelected(null);
                }}
                placeholder="Busque por nome do município (ex: Inhapi, Palmeira dos Índios)..."
                className="h-11 rounded-full border-[#F0F1F5] bg-[#F7F6FA]/50 pl-10 text-xs font-semibold text-[#16181D] placeholder:text-[#A2A6B2] focus:border-[#16181D] focus:bg-white"
                autoFocus
              />
            </div>

            {/* Resultados do Autocomplete */}
            {results.length > 0 && !selected && (
              <div className="absolute left-0 top-full z-50 mt-1 max-h-[220px] w-full overflow-y-auto rounded-xl border border-[#F0F1F5] bg-white shadow-xl">
                {results.map((m) => (
                  <button
                    key={m.codigoIbge}
                    type="button"
                    onClick={() => handleSelect(m)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[#F7F6FA] border-b border-[#F0F1F5] last:border-none"
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
              placeholder="Ex: 1250000"
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
              "Adicionar ao Pipeline"
            )}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
