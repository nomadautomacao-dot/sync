"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, FileTextIcon, LoaderIcon, ZapIcon } from "lucide-react";
import { toast } from "sonner";

import type { IbgeMunicipio } from "@/core/lib/ibge-client";

import { BuscaMunicipio } from "./_components/busca-municipio";
import { CabecalhoMunicipio } from "./_components/cabecalho-municipio";
import { DocumentoCard } from "./_components/documento-card";
import { PainelCenso } from "./_components/painel-censo";
import { PainelProjecao } from "./_components/painel-projecao";
import type { RespostaLevantamento } from "./_components/tipos";

type Documento = "raio-x" | "levantamento";

/**
 * Os dois documentos que o módulo produz, nesta ordem de uso.
 *
 * O Raio-X é a cidade inteira, o passo que antecede a conversa de fundo — a
 * equipe chega sabendo o município. O Diagnóstico é o aprofundamento no FUNDEB.
 * Ambos partem da mesma carga de dados: a rota remonta o município no servidor.
 */
const DOCUMENTOS = [
  {
    id: "raio-x" as const,
    icone: ZapIcon,
    nome: "Raio-X Municipal",
    paginas: 18,
    variante: "secundario" as const,
    prefixoArquivo: "RaioX_Municipal",
    endpoint: "/api/modulos/levantamento-fundeb/raio-x",
    descricao:
      "A cidade inteira antes da conversa de fundo. Todo número traz fonte e ano.",
    conteudo: [
      "Saneamento (Censo 2022)",
      "Rede de saúde (CNES)",
      "Emprego formal (CAGED)",
      "Vulnerabilidade (CadÚnico)",
      "Capacidade institucional (MUNIC)",
    ],
  },
  {
    id: "levantamento" as const,
    icone: FileTextIcon,
    nome: "Diagnóstico FUNDEB",
    paginas: 10,
    variante: "primario" as const,
    prefixoArquivo: "Levantamento_FUNDEB",
    endpoint: "/api/modulos/levantamento-fundeb/pdf?tipo=levantamento",
    descricao:
      "O aprofundamento no fundo: repasses, projeção de ganho e plano de ação.",
    conteudo: [
      "VAAF / VAAT / VAAR",
      "Projeção de ganho",
      "Censo Escolar INEP",
      "Série histórica",
      "Saúde fiscal",
      "Plano de ação",
    ],
  },
];

export default function LevantamentoFundebPage() {
  return (
    <Suspense fallback={<EsqueletoDaBancada />}>
      <Bancada />
    </Suspense>
  );
}

function Bancada() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /* O município ativo mora na URL: é o que faz a faixa "retomar" do hub abrir a
     bancada já carregada, e o que deixa a tela sobreviver a um refresh. */
  const codigoIbge = searchParams.get("ibge");

  /* A escolha da busca fica em memória só para mostrar o nome antes de o
     relatório chegar. Se a URL apontar para outro município, ela não vale. */
  const [escolhido, setEscolhido] = useState<IbgeMunicipio | null>(null);
  const escolhidoValido = escolhido?.codigoIbge === codigoIbge ? escolhido : null;

  const [gerando, setGerando] = useState<Documento | null>(null);

  const {
    data: resposta,
    isLoading,
    error,
  } = useQuery<RespostaLevantamento>({
    queryKey: ["levantamento-fundeb", codigoIbge],
    queryFn: async () => {
      const res = await fetch(`/api/modulos/levantamento-fundeb/${codigoIbge}`);
      if (!res.ok) {
        const detalhe = await res.json().catch(() => null);
        throw new Error(detalhe?.error ?? "Não foi possível carregar os dados deste município.");
      }
      return res.json();
    },
    enabled: !!codigoIbge,
  });

  const relatorio = resposta?.relatorio;
  const identificacao = relatorio?.identificacao;

  /* Chegando pela URL, o nome e a UF só existem depois que o relatório carrega —
     e os dois são obrigatórios no corpo que as rotas de PDF recebem. */
  const municipio: IbgeMunicipio | null =
    escolhidoValido ??
    (codigoIbge && identificacao?.municipioNome && identificacao.uf
      ? {
          codigoIbge,
          nome: identificacao.municipioNome,
          uf: identificacao.uf,
          regiao: identificacao.regiao ?? "",
        }
      : null);

  const selecionarMunicipio = (selecionado: IbgeMunicipio) => {
    setEscolhido(selecionado);
    router.replace(`${pathname}?ibge=${selecionado.codigoIbge}`, { scroll: false });
  };

  const trocarMunicipio = () => {
    setEscolhido(null);
    router.replace(pathname, { scroll: false });
  };

  const gerarDocumento = async (documento: (typeof DOCUMENTOS)[number]) => {
    if (!municipio) {
      toast.error("Aguarde o município terminar de carregar.");
      return;
    }

    setGerando(documento.id);
    try {
      const res = await fetch(documento.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo_ibge: municipio.codigoIbge,
          nome: municipio.nome,
          uf: municipio.uf,
        }),
      });

      if (!res.ok) {
        /* A rota devolve `{ error }` em JSON; mostrar a mensagem do servidor
           evita o "falhou" genérico que não diz o que corrigir. */
        const detalhe = await res.json().catch(() => null);
        throw new Error(detalhe?.error ?? `Falha na geração (HTTP ${res.status}).`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${documento.prefixoArquivo}_${municipio.nome}_${municipio.uf}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${documento.nome} gerado.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar o documento.");
    } finally {
      setGerando(null);
    }
  };

  return (
    <div className="flex flex-col gap-[14px] px-[4px] pt-[4px] pb-[14px]">
      <header>
        <nav className="flex items-center gap-[5px] text-[11.5px] text-[#A2A6B2]">
          <Link href="/modulos" className="transition-colors hover:text-[#16181D]">
            Módulos
          </Link>
          <ChevronRightIcon className="size-[12px]" />
          <span className="text-[#767A86]">Levantamento FUNDEB</span>
        </nav>

        <h1 className="mt-[6px] text-[21px] font-bold tracking-[-0.7px] text-[#16181D]">
          Central de Relatórios &amp; Levantamentos FUNDEB
        </h1>
        <p className="mt-[3px] text-[13px] text-[#767A86]">
          Raio-X da cidade inteira e diagnóstico técnico de repasses, a partir de IBGE, FNDE, INEP,
          DATASUS, CAGED, CadÚnico e SICONFI.
        </p>
      </header>

      {!codigoIbge ? (
        <BuscaMunicipio onSelecionar={selecionarMunicipio} />
      ) : (
        <>
          {municipio ? (
            <CabecalhoMunicipio
              nome={municipio.nome}
              uf={municipio.uf}
              codigoIbge={municipio.codigoIbge}
              mesorregiao={identificacao?.mesorregiao}
              regiao={identificacao?.regiao ?? municipio.regiao}
              prefeito={identificacao?.prefeito}
              partido={identificacao?.partido}
              onTrocar={trocarMunicipio}
            />
          ) : (
            <div
              role="status"
              aria-label="Carregando o município"
              className="h-[80px] animate-pulse rounded-[16px] border border-white/95 bg-white/60"
            />
          )}

          <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
            {DOCUMENTOS.map((documento) => (
              <DocumentoCard
                key={documento.id}
                icone={documento.icone}
                nome={documento.nome}
                paginas={documento.paginas}
                descricao={documento.descricao}
                conteudo={documento.conteudo}
                variante={documento.variante}
                gerando={gerando === documento.id}
                desabilitado={!municipio || gerando !== null}
                onGerar={() => gerarDocumento(documento)}
              />
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-[10px] rounded-[16px] border border-white/95 bg-white/88 py-[48px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
              <LoaderIcon className="size-[16px] animate-spin text-[#A2A6B2]" />
              <span className="text-[12.5px] text-[#767A86]">
                Consultando portarias FNDE, Censo INEP e SICONFI…
              </span>
            </div>
          ) : error ? (
            <ErroDoLevantamento
              mensagem={error instanceof Error ? error.message : "Erro ao carregar o município."}
              onTrocar={trocarMunicipio}
            />
          ) : relatorio ? (
            <>
              <PainelProjecao
                projecao={relatorio.projecao}
                recuperavel={relatorio.projecaoRecuperavel}
              />
              <PainelCenso
                censo={relatorio.censoEscolar}
                perfil={relatorio.perfilComercial}
                projecao={relatorio.projecao}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function ErroDoLevantamento({ mensagem, onTrocar }: { mensagem: string; onTrocar: () => void }) {
  return (
    <section className="rounded-[16px] border border-white/95 bg-white/88 p-[24px] text-center shadow-[0_10px_26px_rgba(22,24,29,.05)]">
      <p className="text-[13px] font-semibold text-[#991B1B]">{mensagem}</p>
      <p className="mt-[6px] text-[12px] text-[#767A86]">
        Os documentos acima dependem desses dados e seguem indisponíveis para este município.
      </p>
      <button
        type="button"
        onClick={onTrocar}
        className="mt-[16px] inline-flex h-[38px] items-center rounded-[20px] bg-[#F2F1F7] px-[16px] text-[12.5px] font-semibold text-[#3B3F4A] transition-colors hover:bg-[#ECEBF2]"
      >
        Escolher outro município
      </button>
    </section>
  );
}

function EsqueletoDaBancada() {
  return (
    <div
      role="status"
      aria-label="Carregando o levantamento"
      className="flex animate-pulse flex-col gap-[14px] px-[4px] pt-[4px]"
    >
      <div className="h-[56px] w-[420px] max-w-full rounded-[12px] bg-white/50" />
      <div className="h-[150px] rounded-[16px] border border-white/95 bg-white/60" />
    </div>
  );
}
