"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  LoaderCircleIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  TrendingUpIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import {
  ensureCity,
  listCities,
} from "@/core/lib/cities-firestore";
import {
  STAGE_LABELS,
  stagePastelTone,
  type CityAccount,
} from "@/core/lib/city-types";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import { listCityReports } from "@/modules/cidades/city-reports-firestore";
import { listCityDocuments } from "@/modules/documentos/documentos-firestore";

import { NewCityDialog } from "../pipeline/_components/new-city-dialog";

/**
 * A carteira é uma tabela, não uma galeria.
 *
 * Cada município carrega seis fatos — UF, IBGE, estágio, probabilidade,
 * relatórios, documentos. Em card isso ocupava 300×250px e cabiam seis
 * municípios na tela; em linha ocupa 38px de altura e cabem todos, ordenáveis
 * por qualquer uma das seis colunas. O título da página saiu porque a barra de
 * cima já escreve "Cidades" — eram dois títulos para uma tela só.
 */

type ChaveDeOrdem =
  | "name"
  | "uf"
  | "stage"
  | "probability"
  | "reports"
  | "documents";

interface Ordem {
  chave: ChaveDeOrdem;
  direcao: "asc" | "desc";
}

export default function CidadesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [newCityOpen, setNewCityOpen] = useState(false);
  const [ordem, setOrdem] = useState<Ordem>({ chave: "name", direcao: "asc" });

  const {
    data: cities = [],
    isPending: citiesPending,
    isError: citiesError,
    refetch: refetchCities,
  } = useQuery({
    queryKey: ["cities", user?.groupId],
    queryFn: () => listCities(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });
  const { data: documents = [], isPending: documentsPending } = useQuery({
    queryKey: ["city-documents", user?.groupId],
    queryFn: () => listCityDocuments(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });
  const { data: reports = [], isPending: reportsPending } = useQuery({
    queryKey: ["city-reports", user?.groupId],
    queryFn: () => listCityReports(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  const createMutation = useMutation({
    mutationFn: (
      input: Partial<CityAccount> & { name: string; uf: string },
    ) => ensureCity(getFirebaseDb(), user!.groupId, input),
    onSuccess: (city) => {
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] });
      setNewCityOpen(false);
      toast.success(`${city.name} está pronta na carteira.`);
      router.push(`/cidades/${city.id}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar o município.",
      ),
  });

  const countsByCity = useMemo(() => {
    const result = new Map<string, { documents: number; reports: number }>();
    for (const city of cities) {
      result.set(city.id, { documents: 0, reports: 0 });
    }
    for (const document of documents) {
      const current = result.get(document.cityId);
      if (current) current.documents += 1;
    }
    for (const report of reports) {
      const current = result.get(report.cityId);
      if (current) current.reports += 1;
    }
    return result;
  }, [cities, documents, reports]);

  const filteredCities = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const filtradas = cities.filter((city) => {
      if (stage !== "all" && city.stage !== stage) return false;
      if (!term) return true;
      return `${city.name} ${city.uf} ${city.codigoIbge}`
        .toLocaleLowerCase("pt-BR")
        .includes(term);
    });

    const sinal = ordem.direcao === "asc" ? 1 : -1;
    const contagem = (id: string) =>
      countsByCity.get(id) ?? { documents: 0, reports: 0 };

    return [...filtradas].sort((a, b) => {
      switch (ordem.chave) {
        case "uf":
          return sinal * a.uf.localeCompare(b.uf, "pt-BR");
        case "stage":
          return (
            sinal *
            (STAGE_LABELS[a.stage] ?? a.stage).localeCompare(
              STAGE_LABELS[b.stage] ?? b.stage,
              "pt-BR",
            )
          );
        case "probability":
          return sinal * (a.probability - b.probability);
        case "reports":
          return sinal * (contagem(a.id).reports - contagem(b.id).reports);
        case "documents":
          return sinal * (contagem(a.id).documents - contagem(b.id).documents);
        default:
          return sinal * a.name.localeCompare(b.name, "pt-BR");
      }
    });
  }, [cities, countsByCity, ordem, search, stage]);

  const alternarOrdem = (chave: ChaveDeOrdem) =>
    setOrdem((atual) =>
      atual.chave === chave
        ? { chave, direcao: atual.direcao === "asc" ? "desc" : "asc" }
        : // Nome começa em A→Z; número começa no maior, que é o que se procura.
          { chave, direcao: chave === "name" || chave === "uf" ? "asc" : "desc" },
    );

  const loading = citiesPending || documentsPending || reportsPending;
  const withReport = new Set(reports.map((report) => report.cityId)).size;
  const inContract = cities.filter((city) =>
    ["contractual", "implementation", "assisted_operation", "fidelized"].includes(
      city.stage,
    ),
  ).length;

  return (
    <div className="flex min-h-full flex-col gap-2.5 px-1 pb-4 pt-1">
      <section className="glass-card flex flex-wrap items-center gap-x-1 gap-y-2 px-4 py-2">
        {/* Sem a barra de cima, o nome da tela mora aqui — na mesma faixa dos
            números, sem gastar uma linha só para si. */}
        <h1 className="pr-1 text-[15px] font-bold tracking-[-0.4px] text-[#16181D]">
          Cidades
        </h1>
        <Divisor />
        <Numero valor={cities.length} rotulo="municípios" />
        <Divisor />
        <Numero
          valor={withReport}
          rotulo="com relatório"
          detalhe={`${reports.length} versões`}
        />
        <Divisor />
        <Numero valor={documents.length} rotulo="documentos" />
        <Divisor />
        <Numero valor={inContract} rotulo="em contrato" />

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/pipeline"
            className="flex h-9 items-center gap-1.5 rounded-full border border-[#E7E8ED] bg-white px-3.5 text-[11px] font-bold text-[#5A5E6A] transition-colors hover:bg-[#F7F6FA] hover:text-[#16181D]"
          >
            <TrendingUpIcon className="size-3.5" />
            Ver Kanban
          </Link>
          <Button
            type="button"
            onClick={() => setNewCityOpen(true)}
            className="h-9 rounded-full bg-[#16181D] px-3.5 text-[11px] font-bold text-white hover:bg-[#2C2F38]"
          >
            <PlusIcon className="size-3.5" />
            Novo município
          </Button>
        </div>
      </section>

      <section className="glass-card flex min-h-[420px] flex-1 flex-col overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-[#F0F1F5] p-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-[#A2A6B2]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrar por município, UF ou código IBGE…"
              className="h-9 rounded-full border-[#E7E8ED] bg-[#FAFAFC] pl-9 text-[12px]"
            />
          </div>
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="h-9 min-w-[180px] rounded-full border border-[#E7E8ED] bg-[#FAFAFC] px-3 text-[11px] font-semibold text-[#5A5E6A] outline-none focus:border-[#16181D]"
          >
            <option value="all">Todos os estágios</option>
            {Object.entries(STAGE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          {!loading && !citiesError && (
            <span className="shrink-0 px-1 font-mono text-[10px] text-[#A2A6B2]">
              {filteredCities.length === cities.length
                ? `${cities.length} municípios`
                : `${filteredCities.length} de ${cities.length}`}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <LoaderCircleIcon className="size-6 animate-spin text-[#767A86]" />
          </div>
        ) : citiesError ? (
          <div
            role="alert"
            className="flex flex-1 flex-col items-center justify-center py-20 text-center"
          >
            <div className="flex size-12 items-center justify-center rounded-[16px] bg-[#FBE9EE]">
              <MapPinIcon className="size-5 text-[#8A3A50]" />
            </div>
            <h2 className="mt-3 text-[13px] font-bold text-[#16181D]">
              Não foi possível carregar as cidades
            </h2>
            <p className="mt-1 text-[10.5px] text-[#767A86]">
              Verifique a conexão e tente novamente.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => refetchCities()}
              className="mt-3 h-9 rounded-full px-4 text-[11px] font-bold"
            >
              Tentar novamente
            </Button>
          </div>
        ) : filteredCities.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
            <div className="flex size-12 items-center justify-center rounded-[16px] bg-[#F2F1F7]">
              <MapPinIcon className="size-5 text-[#767A86]" />
            </div>
            <h2 className="mt-3 text-[13px] font-bold text-[#16181D]">
              Nenhuma cidade encontrada
            </h2>
            <p className="mt-1 text-[10.5px] text-[#767A86]">
              Adicione um município ou altere os filtros.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
                <tr className="border-b border-[#ECEDF2]">
                  <Cabecalho
                    rotulo="UF"
                    chave="uf"
                    ordem={ordem}
                    aoOrdenar={alternarOrdem}
                    className="w-[62px] pl-4"
                  />
                  <Cabecalho
                    rotulo="Município"
                    chave="name"
                    ordem={ordem}
                    aoOrdenar={alternarOrdem}
                  />
                  <th className="hidden px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[1.1px] text-[#A2A6B2] lg:table-cell">
                    IBGE
                  </th>
                  <Cabecalho
                    rotulo="Estágio"
                    chave="stage"
                    ordem={ordem}
                    aoOrdenar={alternarOrdem}
                    className="w-[150px]"
                  />
                  <Cabecalho
                    rotulo="Prob."
                    chave="probability"
                    ordem={ordem}
                    aoOrdenar={alternarOrdem}
                    numerica
                    className="w-[76px]"
                  />
                  <Cabecalho
                    rotulo="Relat."
                    chave="reports"
                    ordem={ordem}
                    aoOrdenar={alternarOrdem}
                    numerica
                    className="w-[72px]"
                  />
                  <Cabecalho
                    rotulo="Docs"
                    chave="documents"
                    ordem={ordem}
                    aoOrdenar={alternarOrdem}
                    numerica
                    className="w-[68px]"
                  />
                  <th className="hidden px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[1.1px] text-[#A2A6B2] xl:table-cell">
                    Próxima ação
                  </th>
                  <th className="w-[38px]" />
                </tr>
              </thead>

              <tbody>
                {filteredCities.map((city) => {
                  const tone = stagePastelTone(city.stage);
                  const counts = countsByCity.get(city.id) ?? {
                    documents: 0,
                    reports: 0,
                  };
                  return (
                    <tr
                      key={city.id}
                      onClick={() => router.push(`/cidades/${city.id}`)}
                      className="group cursor-pointer border-b border-[#F4F4F8] transition-colors last:border-0 hover:bg-[#F7F6FA]"
                    >
                      <td className="py-[9px] pl-4 pr-2 font-mono text-[10.5px] font-bold text-[#5A5E6A]">
                        {city.uf}
                      </td>
                      <td className="px-3 py-[9px]">
                        {/* O link real vive aqui: a linha inteira responde ao
                            clique, mas quem navega por teclado precisa de foco. */}
                        <Link
                          href={`/cidades/${city.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-[12.5px] font-semibold text-[#16181D] outline-none hover:underline focus-visible:underline"
                        >
                          {city.name}
                        </Link>
                      </td>
                      <td className="hidden px-3 py-[9px] font-mono text-[10.5px] text-[#A2A6B2] lg:table-cell">
                        {city.codigoIbge || "—"}
                      </td>
                      <td className="px-3 py-[9px]">
                        <span
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[9.5px] font-bold"
                          style={{ backgroundColor: tone.bg, color: tone.text }}
                        >
                          <span
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: tone.dot }}
                          />
                          {STAGE_LABELS[city.stage] ?? city.stage}
                        </span>
                      </td>
                      <td className="px-3 py-[9px] text-right font-mono text-[11px] text-[#5A5E6A]">
                        {city.probability}%
                      </td>
                      <NumeroDaLinha valor={counts.reports} />
                      <NumeroDaLinha valor={counts.documents} />
                      <td className="hidden max-w-[280px] truncate px-3 py-[9px] text-[11px] text-[#767A86] xl:table-cell">
                        {city.nextStepDescription || "—"}
                      </td>
                      <td className="pr-3 text-right">
                        <ChevronRightIcon className="inline size-4 text-[#D6D7DE] transition-colors group-hover:text-[#16181D]" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <NewCityDialog
        open={newCityOpen}
        onClose={() => setNewCityOpen(false)}
        context="cities"
        onSubmit={async (input) => {
          await createMutation.mutateAsync(input);
        }}
      />
    </div>
  );
}

/** Zero em cinza claro: distingue "nenhum" de "um" sem precisar ler o número. */
function NumeroDaLinha({ valor }: { valor: number }) {
  return (
    <td
      className={`px-3 py-[9px] text-right font-mono text-[11px] ${
        valor > 0 ? "font-semibold text-[#16181D]" : "text-[#C1C3CB]"
      }`}
    >
      {valor}
    </td>
  );
}

function Numero({
  valor,
  rotulo,
  detalhe,
}: {
  valor: number;
  rotulo: string;
  detalhe?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5 px-2.5">
      <span className="font-mono text-[17px] font-bold leading-none text-[#16181D]">
        {valor}
      </span>
      <span className="text-[10.5px] font-semibold text-[#5A5E6A]">{rotulo}</span>
      {detalhe && (
        <span className="hidden font-mono text-[9.5px] text-[#A2A6B2] sm:inline">
          {detalhe}
        </span>
      )}
    </div>
  );
}

function Divisor() {
  return <span aria-hidden="true" className="h-5 w-px bg-[#ECEDF2]" />;
}

function Cabecalho({
  rotulo,
  chave,
  ordem,
  aoOrdenar,
  numerica = false,
  className = "",
}: {
  rotulo: string;
  chave: ChaveDeOrdem;
  ordem: Ordem;
  aoOrdenar: (chave: ChaveDeOrdem) => void;
  numerica?: boolean;
  className?: string;
}) {
  const ativa = ordem.chave === chave;
  const Icone = !ativa
    ? ChevronsUpDownIcon
    : ordem.direcao === "asc"
      ? ChevronUpIcon
      : ChevronDownIcon;

  return (
    <th
      scope="col"
      aria-sort={
        ativa ? (ordem.direcao === "asc" ? "ascending" : "descending") : "none"
      }
      className={`px-3 py-2 ${className}`}
    >
      <button
        type="button"
        onClick={() => aoOrdenar(chave)}
        className={`group/ord flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[1.1px] transition-colors hover:text-[#16181D] ${
          numerica ? "ml-auto" : ""
        } ${ativa ? "text-[#16181D]" : "text-[#A2A6B2]"}`}
      >
        {rotulo}
        <Icone
          aria-hidden="true"
          className={`size-3 transition-opacity ${
            ativa ? "opacity-100" : "opacity-0 group-hover/ord:opacity-60"
          }`}
        />
      </button>
    </th>
  );
}
