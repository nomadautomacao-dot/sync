"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinIcon, SearchIcon } from "lucide-react";

import { searchMunicipios, type IbgeMunicipio } from "@/core/lib/ibge-client";

interface BuscaMunicipioProps {
  onSelecionar: (municipio: IbgeMunicipio) => void;
}

/**
 * Busca de município na base IBGE, com autocomplete.
 *
 * Cada consulta carrega um número de sequência e só a mais recente pode escrever
 * na lista: digitando rápido, uma resposta lenta de duas letras atrás chegaria
 * depois da atual e sobrescreveria os resultados certos.
 */
export function BuscaMunicipio({ onSelecionar }: BuscaMunicipioProps) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<IbgeMunicipio[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState("");
  const sequenciaRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) setResultados([]);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const aoDigitar = async (valor: string) => {
    setTermo(valor);
    setErroBusca("");

    const sequencia = ++sequenciaRef.current;
    if (valor.trim().length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    try {
      const encontrados = await searchMunicipios(valor);
      if (sequencia !== sequenciaRef.current) return;
      setResultados(encontrados);
    } catch (error) {
      if (sequencia !== sequenciaRef.current) return;
      setResultados([]);
      setErroBusca(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar a base IBGE.",
      );
    } finally {
      if (sequencia === sequenciaRef.current) setBuscando(false);
    }
  };

  const semResultado =
    !buscando &&
    !erroBusca &&
    termo.trim().length >= 2 &&
    resultados.length === 0;

  return (
    <section className="rounded-[16px] border border-white/95 bg-white/88 p-[20px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
      <h2 className="text-[15px] font-bold tracking-[-0.3px] text-[#16181D]">
        Pesquisar município
      </h2>
      <p className="mt-[3px] text-[12px] text-[#767A86]">
        Nome ou código IBGE. Carrega repasses VAAF, VAAT e VAAR, Censo Escolar e saúde fiscal.
      </p>

      <div ref={containerRef} className="relative mt-[16px] max-w-[560px]">
        <SearchIcon className="pointer-events-none absolute left-[14px] top-1/2 size-[15px] -translate-y-1/2 text-[#A2A6B2]" />

        <input
          type="text"
          value={termo}
          onChange={(evento) => aoDigitar(evento.target.value)}
          onKeyDown={(evento) => evento.key === "Escape" && setResultados([])}
          placeholder="Ex.: Bom Jesus da Lapa, Inhapi, Palmeira dos Índios…"
          aria-label="Nome ou código IBGE do município"
          aria-busy={buscando}
          className="h-[44px] w-full rounded-[24px] border border-white/90 bg-[#F2F1F7] pl-[38px] pr-[16px] text-[13px] text-[#16181D] transition-colors placeholder:text-[#A2A6B2] focus:border-[#16181D] focus:bg-white focus:outline-none"
        />

        {resultados.length > 0 && (
          <ul className="glass-popover absolute left-0 top-full z-50 mt-[6px] max-h-[280px] w-full overflow-y-auto p-[6px]">
            {resultados.map((municipio) => (
              <li key={municipio.codigoIbge}>
                <button
                  type="button"
                  onClick={() => {
                    setResultados([]);
                    setTermo("");
                    onSelecionar(municipio);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-[12px] px-[12px] py-[10px] text-left transition-colors hover:bg-[#F7F6FA]"
                >
                  <span className="flex min-w-0 items-center gap-[8px]">
                    <MapPinIcon className="size-[14px] shrink-0 text-[#A2A6B2]" />
                    <span className="truncate text-[13px] font-semibold text-[#16181D]">
                      {municipio.nome}
                    </span>
                    <span className="shrink-0 rounded-[14px] bg-[#F2F1F7] px-[7px] py-[2px] font-mono text-[10px] font-semibold text-[#5A5E6A]">
                      {municipio.uf}
                    </span>
                  </span>

                  <span className="shrink-0 font-mono text-[10.5px] text-[#A2A6B2]">
                    {municipio.codigoIbge}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {semResultado && (
          <p className="mt-[10px] text-[12px] text-[#767A86]">
            Nenhum município encontrado para “{termo.trim()}”.
          </p>
        )}

        {erroBusca && (
          <p role="alert" className="mt-[10px] text-[12px] text-[#A33D56]">
            {erroBusca}
          </p>
        )}
      </div>
    </section>
  );
}
