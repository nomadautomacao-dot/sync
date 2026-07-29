"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  Building2Icon,
  FileTextIcon,
  FolderArchiveIcon,
  LoaderCircleIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  TrendingUpIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/core/components/ui/badge";
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

export default function CidadesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [newCityOpen, setNewCityOpen] = useState(false);

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
    return cities.filter((city) => {
      if (stage !== "all" && city.stage !== stage) return false;
      if (!term) return true;
      return `${city.name} ${city.uf} ${city.codigoIbge}`
        .toLocaleLowerCase("pt-BR")
        .includes(term);
    });
  }, [cities, search, stage]);

  const loading = citiesPending || documentsPending || reportsPending;
  const withReport = new Set(reports.map((report) => report.cityId)).size;
  const inContract = cities.filter((city) =>
    ["contractual", "implementation", "assisted_operation", "fidelized"].includes(
      city.stage,
    ),
  ).length;

  return (
    <div className="flex min-h-full flex-col gap-[14px] px-1 pb-4 pt-1">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[21px] font-bold tracking-[-0.7px] text-[#16181D]">
              Cidades
            </h1>
            <Badge
              variant="outline"
              className="h-[21px] rounded-full border-white bg-white/70 px-2.5 font-mono text-[9.5px] font-bold text-[#5A5E6A]"
            >
              {cities.length} na carteira
            </Badge>
          </div>
          <p className="mt-1 text-[12.5px] text-[#767A86]">
            Pipeline, levantamentos, relatórios e documentos de cada município.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setNewCityOpen(true)}
          className="h-10 rounded-full bg-[#16181D] px-4 text-[11.5px] font-bold text-white hover:bg-[#2C2F38]"
        >
          <PlusIcon className="size-4" />
          Novo município
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          icon={Building2Icon}
          label="Municípios"
          value={cities.length}
          helper="carteira unificada"
          background="#E2EDFA"
          color="#2C4E82"
        />
        <Metric
          icon={FileTextIcon}
          label="Com relatório"
          value={withReport}
          helper={`${reports.length} versões geradas`}
          background="#DFF2E7"
          color="#1F6A47"
        />
        <Metric
          icon={FolderArchiveIcon}
          label="Documentos"
          value={documents.length}
          helper="arquivos anexados"
          background="#EEE7F9"
          color="#67478C"
        />
        <Metric
          icon={TrendingUpIcon}
          label="Em contrato"
          value={inContract}
          helper="contratual ou operação"
          background="#FBE9EE"
          color="#8A3A50"
        />
      </section>

      <section className="glass-card min-h-[450px] overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#F0F1F5] p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#A2A6B2]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por município, UF ou código IBGE…"
              className="h-10 rounded-full border-[#E7E8ED] bg-[#FAFAFC] pl-10 text-[12px]"
            />
          </div>
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="h-10 min-w-[190px] rounded-full border border-[#E7E8ED] bg-[#FAFAFC] px-3 text-[11px] font-semibold text-[#5A5E6A] outline-none focus:border-[#16181D]"
          >
            <option value="all">Todos os estágios</option>
            {Object.entries(STAGE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <Link
            href="/pipeline"
            className="flex h-10 items-center justify-center gap-2 rounded-full border border-[#E7E8ED] bg-white px-4 text-[11px] font-bold text-[#5A5E6A] hover:bg-[#F7F6FA] hover:text-[#16181D]"
          >
            <TrendingUpIcon className="size-3.5" />
            Ver Kanban
          </Link>
        </div>

        {loading ? (
          <div className="flex h-[360px] items-center justify-center">
            <LoaderCircleIcon className="size-6 animate-spin text-[#767A86]" />
          </div>
        ) : citiesError ? (
          <div
            role="alert"
            className="flex h-[360px] flex-col items-center justify-center text-center"
          >
            <div className="flex size-14 items-center justify-center rounded-[18px] bg-[#FBE9EE]">
              <MapPinIcon className="size-6 text-[#8A3A50]" />
            </div>
            <h2 className="mt-4 text-[13px] font-bold text-[#16181D]">
              Não foi possível carregar as cidades
            </h2>
            <p className="mt-1 text-[10.5px] text-[#767A86]">
              Verifique a conexão e tente novamente.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => refetchCities()}
              className="mt-4 h-9 rounded-full px-4 text-[11px] font-bold"
            >
              Tentar novamente
            </Button>
          </div>
        ) : filteredCities.length === 0 ? (
          <div className="flex h-[360px] flex-col items-center justify-center text-center">
            <div className="flex size-14 items-center justify-center rounded-[18px] bg-[#F2F1F7]">
              <MapPinIcon className="size-6 text-[#767A86]" />
            </div>
            <h2 className="mt-4 text-[13px] font-bold text-[#16181D]">
              Nenhuma cidade encontrada
            </h2>
            <p className="mt-1 text-[10.5px] text-[#767A86]">
              Adicione um município ou altere os filtros.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCities.map((city) => {
              const tone = stagePastelTone(city.stage);
              const counts = countsByCity.get(city.id) ?? {
                documents: 0,
                reports: 0,
              };
              return (
                <Link
                  key={city.id}
                  href={`/cidades/${city.id}`}
                  className="group rounded-[17px] border border-[#F0F1F5] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-white hover:shadow-[0_14px_30px_rgba(22,24,29,.09)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#F2F1F7] font-mono text-[11px] font-bold text-[#3B3F4A]">
                        {city.uf}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-[13px] font-bold text-[#16181D]">
                          {city.name}
                        </h2>
                        <p className="mt-0.5 font-mono text-[9px] text-[#A2A6B2]">
                          IBGE {city.codigoIbge || "não informado"}
                        </p>
                      </div>
                    </div>
                    <ArrowRightIcon className="mt-1 size-4 shrink-0 text-[#C1C3CB] transition-transform group-hover:translate-x-0.5 group-hover:text-[#16181D]" />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9.5px] font-bold"
                      style={{ backgroundColor: tone.bg, color: tone.text }}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: tone.dot }}
                      />
                      {STAGE_LABELS[city.stage] ?? city.stage}
                    </span>
                    <span className="font-mono text-[9px] text-[#A2A6B2]">
                      {city.probability}% prob.
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 divide-x divide-[#F0F1F5] rounded-[12px] bg-[#FAFAFC] py-2.5">
                    <div className="px-3">
                      <div className="font-mono text-[15px] font-bold text-[#16181D]">
                        {counts.reports}
                      </div>
                      <div className="text-[9px] text-[#A2A6B2]">
                        relatórios
                      </div>
                    </div>
                    <div className="px-3">
                      <div className="font-mono text-[15px] font-bold text-[#16181D]">
                        {counts.documents}
                      </div>
                      <div className="text-[9px] text-[#A2A6B2]">
                        documentos
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 truncate text-[10px] text-[#767A86]">
                    {city.nextStepDescription || "Próxima ação ainda não definida"}
                  </p>
                </Link>
              );
            })}
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

function Metric({
  icon: Icon,
  label,
  value,
  helper,
  background,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  helper: string;
  background: string;
  color: string;
}) {
  return (
    <div className="glass-card flex min-h-[88px] items-center gap-3.5 p-4">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-[14px]"
        style={{ backgroundColor: background }}
      >
        <Icon className="size-[18px]" style={{ color }} />
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[21px] font-bold text-[#16181D]">
            {value}
          </span>
          <span className="text-[10px] font-bold text-[#5A5E6A]">{label}</span>
        </div>
        <p className="text-[9.5px] text-[#A2A6B2]">{helper}</p>
      </div>
    </div>
  );
}
