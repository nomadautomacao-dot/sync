"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowUpRightIcon,
  BotIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  DownloadIcon,
  EyeIcon,
  FileIcon,
  FileTextIcon,
  FolderArchiveIcon,
  LandmarkIcon,
  LoaderCircleIcon,
  MapPinIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  SaveIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/core/components/ui/button";
import { VisualizadorPdf } from "@/core/components/visualizador-pdf";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/components/ui/dropdown-menu";
import { Input } from "@/core/components/ui/input";
import {
  deleteCity,
  getCity,
  updateCityPipeline,
} from "@/core/lib/cities-firestore";
import {
  STAGE_KEYS,
  STAGE_LABELS,
  formatCurrency,
  stagePastelTone,
  stageProbability,
  type CityAccount,
  type StageKey,
} from "@/core/lib/city-types";
import { getFirebaseDb, getFirebaseStorage } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import { listCityReports } from "@/modules/cidades/city-reports-firestore";
import {
  CITY_REPORT_TYPE_LABELS,
  type CityReport,
} from "@/modules/cidades/reports-types";
import {
  formatFileSize,
  listCityDocuments,
  uploadCityDocument,
} from "@/modules/documentos/documentos-firestore";
import type {
  CityDocument,
  CreateCityDocumentInput,
} from "@/modules/documentos/types";

import { DocumentUploadDialog } from "../../documentos/_components/document-upload-dialog";
import pageStyles from "./city-detail.module.css";
import { DeleteCityDialog } from "./_components/delete-city-dialog";
import { FundebDataTab } from "./_components/fundeb-data-tab";

type CityTab = "visao-geral" | "dados-fundeb" | "relatorios" | "documentos";

export default function CidadeDetailPage() {
  const params = useParams<{ cityId: string }>();
  const cityId = params.cityId;
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<CityTab>("visao-geral");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const {
    data: city,
    isPending: cityPending,
    error: cityError,
  } = useQuery({
    queryKey: ["city", cityId],
    queryFn: () => getCity(getFirebaseDb(), cityId),
    enabled: Boolean(cityId),
  });

  const {
    data: reports = [],
    isPending: reportsPending,
    error: reportsError,
  } = useQuery({
    queryKey: ["city-reports", user?.groupId, cityId],
    queryFn: () => listCityReports(getFirebaseDb(), user!.groupId, cityId),
    enabled: Boolean(user?.groupId && cityId),
  });

  const { data: allDocuments = [], isPending: documentsPending } = useQuery({
    queryKey: ["city-documents", user?.groupId],
    queryFn: () => listCityDocuments(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });
  const documents = useMemo(
    () => allDocuments.filter((document) => document.cityId === cityId),
    [allDocuments, cityId],
  );

  const uploadMutation = useMutation({
    mutationFn: ({
      file,
      input,
    }: {
      file: File;
      input: Omit<
        CreateCityDocumentInput,
        "groupId" | "createdBy" | "createdByName"
      >;
    }) =>
      uploadCityDocument(getFirebaseDb(), getFirebaseStorage(), file, {
        ...input,
        groupId: user!.groupId,
        createdBy: user!.id,
        createdByName: user!.name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["city-documents"] });
      setUploadOpen(false);
      toast.success("Documento anexado à cidade.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (targetCityId: string) =>
      deleteCity(getFirebaseDb(), targetCityId),
    onSuccess: async () => {
      setDeleteOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cities"] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] }),
        queryClient.invalidateQueries({ queryKey: ["documentos-cities"] }),
        queryClient.invalidateQueries({ queryKey: ["sidebar-cities-real"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-cities-real"] }),
        queryClient.invalidateQueries({ queryKey: ["modulos-cities"] }),
      ]);
      queryClient.removeQueries({ queryKey: ["city", cityId] });
      toast.success("Cidade excluída da carteira. O histórico foi preservado.");
      router.replace("/cidades");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a cidade.",
      );
    },
  });

  const selectedReport =
    reports.find((report) => report.id === selectedReportId) ?? reports[0];

  if (cityPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircleIcon className="size-6 animate-spin text-[#767A86]" />
      </div>
    );
  }

  if (cityError || !city) {
    return (
      <div className="glass-card flex min-h-[420px] flex-col items-center justify-center text-center">
        <MapPinIcon className="size-7 text-[#A2A6B2]" />
        <h1 className="mt-3 text-[14px] font-bold text-[#16181D]">
          Cidade não encontrada
        </h1>
        <Link
          href="/cidades"
          className="mt-4 text-[11px] font-bold text-[#2C4E82] hover:underline"
        >
          Voltar para cidades
        </Link>
      </div>
    );
  }

  const tone = stagePastelTone(city.stage);

  const handleUpload = async (
    file: File,
    input: Omit<
      CreateCityDocumentInput,
      "groupId" | "createdBy" | "createdByName"
    >,
  ) => {
    await uploadMutation.mutateAsync({ file, input });
  };

  return (
    <div className="flex min-h-full flex-col gap-[14px] px-1 pb-4 pt-1">
      <header className="glass-card overflow-hidden">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <Link
              href="/cidades"
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F2F1F7] text-[#5A5E6A] hover:bg-[#ECEBF2] hover:text-[#16181D]"
              aria-label="Voltar para cidades"
            >
              <ArrowLeftIcon className="size-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="truncate text-[21px] font-bold tracking-[-0.7px] text-[#16181D]">
                  {city.name}
                </h1>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9.5px] font-bold"
                  style={{ backgroundColor: tone.bg, color: tone.text }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: tone.dot }}
                  />
                  {STAGE_LABELS[city.stage]}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-[#A2A6B2]">
                {city.uf}
                {city.region ? ` · ${city.region}` : ""} · IBGE{" "}
                {city.codigoIbge || "não informado"} ·{" "}
                {reportsError
                  ? "relatórios indisponíveis"
                  : `${reports.length} relatórios`}{" "}
                · {documents.length} documentos
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUploadOpen(true)}
              className="h-9 rounded-full border-[#E2E3E9] bg-white px-4 text-[11px] font-bold text-[#5A5E6A]"
            >
              <PaperclipIcon className="size-3.5" />
              Anexar documento
            </Button>
            <Button
              asChild
              className="h-9 rounded-full bg-[#16181D] px-4 text-[11px] font-bold text-white hover:bg-[#2C2F38]"
            >
              <Link
                href={`/modulos/levantamento-fundeb?ibge=${city.codigoIbge}`}
              >
                <SparklesIcon className="size-3.5" />
                Gerar relatório
              </Link>
            </Button>
            {(user?.groupRole === "owner" || user?.groupRole === "admin") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    aria-label="Mais opções da cidade"
                    title="Mais opções"
                    className="rounded-full border-[#E2E3E9] bg-white text-[#767A86] hover:bg-[#F2F1F7] hover:text-[#16181D]"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className={pageStyles.optionsMenu}
                >
                  <DropdownMenuLabel className={pageStyles.optionsMenuLabel}>
                    Opções da cidade
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator
                    className={pageStyles.optionsMenuSeparator}
                  />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteOpen(true)}
                    className={pageStyles.optionsMenuItem}
                  >
                    Excluir cidade
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <nav className="flex overflow-x-auto border-t border-[#F0F1F5] px-2 [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["visao-geral", "Visão geral", TrendingUpIcon],
              ["dados-fundeb", "Levantamento FUNDEB", DatabaseIcon],
              [
                "relatorios",
                `Relatórios (${reportsError ? "—" : reports.length})`,
                FileTextIcon,
              ],
              [
                "documentos",
                `Documentos (${documents.length})`,
                FolderArchiveIcon,
              ],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-[10.5px] font-bold transition-colors sm:px-4 ${
                tab === key
                  ? "border-[#16181D] text-[#16181D]"
                  : "border-transparent text-[#A2A6B2] hover:text-[#5A5E6A]"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === "visao-geral" && (
        <OverviewTab
          city={city}
          reports={reports}
          documents={documents}
          onOpenReports={() => setTab("relatorios")}
        />
      )}

      {tab === "relatorios" && (
        <ReportsTab
          city={city}
          reports={reports}
          pending={reportsPending}
          error={reportsError}
          selected={selectedReport}
          onSelect={setSelectedReportId}
        />
      )}

      {tab === "dados-fundeb" && (
        <FundebDataTab
          city={city}
          reports={reports}
          pending={reportsPending}
          selected={selectedReport}
          onSelect={setSelectedReportId}
        />
      )}

      {tab === "documentos" && (
        <DocumentsTab
          documents={documents}
          pending={documentsPending}
          onUpload={() => setUploadOpen(true)}
        />
      )}

      {uploadOpen && (
        <DocumentUploadDialog
          open
          cities={[city]}
          initialCityId={city.id}
          uploading={uploadMutation.isPending}
          onClose={() => {
            if (!uploadMutation.isPending) setUploadOpen(false);
          }}
          onSubmit={handleUpload}
        />
      )}

      {deleteOpen && (
        <DeleteCityDialog
          cityName={city.name}
          deleting={deleteMutation.isPending}
          onClose={() => {
            if (!deleteMutation.isPending) setDeleteOpen(false);
          }}
          onConfirm={() => deleteMutation.mutate(city.id)}
        />
      )}
    </div>
  );
}

function OverviewTab({
  city,
  reports,
  documents,
  onOpenReports,
}: {
  city: CityAccount;
  reports: CityReport[];
  documents: CityDocument[];
  onOpenReports: () => void;
}) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<StageKey>(city.stage);
  const [probability, setProbability] = useState(String(city.probability));
  const [revenue, setRevenue] = useState(String(city.estimatedAnnualRevenue));
  const [nextStep, setNextStep] = useState(city.nextStepDescription ?? "");
  const [dueDate, setDueDate] = useState(city.nextStepDueDate ?? "");

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCityPipeline(getFirebaseDb(), city.id, {
        stage,
        probability: Number(probability),
        estimatedAnnualRevenue: Number(revenue),
        nextStepDescription: nextStep,
        nextStepDueDate: dueDate,
        lastActivityAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["city", city.id] });
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] });
      toast.success("Pipeline da cidade atualizado.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o pipeline.",
      ),
  });

  const latestActivities = [
    ...reports.map((report) => ({
      id: `report-${report.id}`,
      title: report.title,
      meta: `Relatório ${report.exercise}`,
      date: report.generatedAt,
      icon: BotIcon,
      background: "#DFF2E7",
      color: "#1F6A47",
    })),
    ...documents.map((document) => ({
      id: `document-${document.id}`,
      title: document.title,
      meta: "Documento anexado",
      date: document.createdAt,
      icon: PaperclipIcon,
      background: "var(--color-stage-contato-to)",
      color: "var(--color-primary-softer)",
    })),
  ]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 5);

  return (
    <div className="grid gap-[14px] xl:grid-cols-[minmax(480px,1.25fr)_minmax(320px,.75fr)]">
      <section className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold text-[#16181D]">
              Pipeline e próxima ação
            </h2>
            <p className="mt-1 text-[10.5px] text-[#767A86]">
              Este status alimenta o Kanban e o painel comercial.
            </p>
          </div>
          <span className="font-mono text-[10px] text-[#A2A6B2]">
            {probability || 0}% probabilidade
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Estágio atual">
            <select
              value={stage}
              onChange={(event) => {
                const nextStage = event.target.value as StageKey;
                setStage(nextStage);
                setProbability(String(stageProbability(nextStage)));
              }}
              className="h-10 w-full rounded-[12px] border border-[#E2E3E9] bg-white px-3 text-[11.5px] font-semibold text-[#16181D] outline-none focus:border-[#16181D]"
            >
              {STAGE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {STAGE_LABELS[key]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Probabilidade (%)">
            <Input
              type="number"
              min="0"
              max="100"
              value={probability}
              onChange={(event) => setProbability(event.target.value)}
              className="h-10 rounded-[12px] text-[11.5px]"
            />
          </Field>
          <Field label="Receita anual estimada">
            <Input
              type="number"
              min="0"
              step="1000"
              value={revenue}
              onChange={(event) => setRevenue(event.target.value)}
              className="h-10 rounded-[12px] text-[11.5px]"
            />
          </Field>
          <Field label="Prazo da próxima ação">
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="h-10 rounded-[12px] text-[11.5px]"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Próxima ação">
            <textarea
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value)}
              rows={3}
              placeholder="Ex.: Apresentar diagnóstico ao secretário de educação"
              className="w-full resize-none rounded-[12px] border border-[#E2E3E9] bg-white px-3 py-2.5 text-[11.5px] text-[#16181D] outline-none focus:border-[#16181D] focus:ring-2 focus:ring-[#16181D]/10"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="h-9 rounded-full bg-[#16181D] px-4 text-[11px] font-bold text-white"
          >
            {saveMutation.isPending ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            Salvar acompanhamento
          </Button>
        </div>
      </section>

      <div className="flex flex-col gap-[14px]">
        <section className="glass-card p-5">
          <h2 className="text-[13px] font-bold text-[#16181D]">
            Resumo da cidade
          </h2>
          <div className="mt-4 grid grid-cols-3 divide-x divide-[#F0F1F5]">
            <SummaryNumber value={reports.length} label="relatórios" />
            <SummaryNumber value={documents.length} label="documentos" />
            <SummaryNumber
              value={`${city.probability}%`}
              label="probabilidade"
            />
          </div>
          <div className="mt-4 rounded-[12px] bg-[#FAFAFC] p-3">
            <div className="text-[9px] font-bold text-[#A2A6B2] uppercase">
              Receita estimada
            </div>
            <div className="mt-1 font-mono text-[16px] font-bold text-[#16181D]">
              {formatCurrency(city.estimatedAnnualRevenue)}
            </div>
          </div>
          {reports[0] && (
            <button
              type="button"
              onClick={onOpenReports}
              className="mt-3 flex w-full items-center justify-between rounded-[12px] border border-[#F0F1F5] p-3 text-left hover:bg-[#FAFAFC]"
            >
              <div>
                <div className="text-[10.5px] font-bold text-[#16181D]">
                  {reports[0].title}
                </div>
                <div className="mt-0.5 text-[9px] text-[#A2A6B2]">
                  Último relatório · {formatDate(reports[0].generatedAt)}
                </div>
              </div>
              <ArrowUpRightIcon className="size-3.5 text-[#767A86]" />
            </button>
          )}
        </section>

        <section className="glass-card flex-1 p-5">
          <h2 className="text-[13px] font-bold text-[#16181D]">
            Atividade recente
          </h2>
          {latestActivities.length ? (
            <div className="mt-3 space-y-1">
              {latestActivities.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-2.5 rounded-[11px] px-1 py-2"
                  >
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-[9px]"
                      style={{ backgroundColor: activity.background }}
                    >
                      <Icon
                        className="size-3.5"
                        style={{ color: activity.color }}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[10px] font-bold text-[#3B3F4A]">
                        {activity.title}
                      </div>
                      <div className="mt-0.5 text-[8.5px] text-[#A2A6B2]">
                        {activity.meta} · {formatDate(activity.date)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-[10px] text-[#A2A6B2]">
              A atividade aparecerá quando um relatório ou documento for salvo.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function ReportsTab({
  city,
  reports,
  pending,
  error,
  selected,
  onSelect,
}: {
  city: CityAccount;
  reports: CityReport[];
  pending: boolean;
  error: unknown;
  selected?: CityReport;
  onSelect: (id: string) => void;
}) {
  if (pending) {
    return (
      <div className="glass-card flex min-h-[460px] items-center justify-center">
        <LoaderCircleIcon className="size-6 animate-spin text-[#767A86]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card flex min-h-[460px] flex-col items-center justify-center px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-[20px] bg-[#FBF0D9]">
          <AlertTriangleIcon className="size-7 text-[#8A5A00]" />
        </div>
        <h2 className="mt-4 text-[14px] font-bold text-[#16181D]">
          Não foi possível consultar os relatórios
        </h2>
        <p className="mt-1.5 max-w-md text-[10.5px] leading-relaxed text-[#767A86]">
          A leitura do histórico falhou. Verifique as regras do Firestore e
          tente recarregar a página; o sistema não exibirá “zero” enquanto a
          consulta estiver indisponível.
        </p>
      </div>
    );
  }

  if (!reports.length) {
    return (
      <div className="glass-card flex min-h-[460px] flex-col items-center justify-center text-center">
        <div className="flex size-16 items-center justify-center rounded-[20px] bg-[#F2F1F7]">
          <FileTextIcon className="size-7 text-[#767A86]" />
        </div>
        <h2 className="mt-4 text-[14px] font-bold text-[#16181D]">
          Nenhum relatório gerado
        </h2>
        <p className="mt-1.5 max-w-sm text-[10.5px] text-[#767A86]">
          Gere o primeiro levantamento. O PDF e uma versão navegável ficarão
          vinculados automaticamente a esta cidade.
        </p>
        <Button
          asChild
          className="mt-5 h-9 rounded-full bg-[#16181D] px-4 text-[11px] font-bold text-white"
        >
          <Link href={`/modulos/levantamento-fundeb?ibge=${city.codigoIbge}`}>
            <SparklesIcon className="size-3.5" />
            Gerar levantamento
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid min-h-[520px] gap-[14px] xl:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="glass-card p-3">
        <div className="px-2 pb-2 pt-1 font-mono text-[9px] font-bold tracking-[1px] text-[#A2A6B2] uppercase">
          Histórico de versões
        </div>
        <div className="space-y-1.5">
          {reports.map((report) => {
            const active = selected?.id === report.id;
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => onSelect(report.id)}
                className={`w-full rounded-[13px] border p-3 text-left transition-colors ${
                  active
                    ? "border-[#D9D7E2] bg-[#F2F1F7]"
                    : "border-transparent hover:bg-[#FAFAFC]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ${
                      active ? "bg-white" : "bg-[#F2F1F7]"
                    }`}
                  >
                    <FileTextIcon className="size-4 text-[#5A5E6A]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10.5px] font-bold text-[#16181D]">
                      {report.title}
                    </div>
                    <div className="mt-1 font-mono text-[8.5px] text-[#A2A6B2]">
                      {report.exercise} · {formatDate(report.generatedAt)}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      {report.downloadUrl ? (
                        <span className="rounded-full bg-[#DFF2E7] px-2 py-0.5 text-[8px] font-bold text-[#1F6A47]">
                          PDF arquivado
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#FBF0D9] px-2 py-0.5 text-[8px] font-bold text-[#8A5A00]">
                          versão navegável
                        </span>
                      )}
                      {report.snapshot && (
                        <span className="rounded-full bg-[#EEE7F9] px-2 py-0.5 text-[8px] font-bold text-[#67478C]">
                          JSON salvo
                          {report.snapshotBytes
                            ? ` · ${formatJsonSize(report.snapshotBytes)}`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {selected && <ReportPreview report={selected} />}
    </div>
  );
}

function ReportPreview({ report }: { report: CityReport }) {
  const [pdfAberto, setPdfAberto] = useState(false);
  const snapshot = report.snapshot;
  const identification = snapshot?.identificacao;
  const projection =
    snapshot?.projecaoRecuperavel ?? snapshot?.projecao ?? undefined;
  const census = snapshot?.censoEscolar;

  const municipality =
    stringField(identification, "municipioNome") ||
    stringField(identification, "municipio") ||
    report.cityName;
  const current = numberField(projection, "totalAtual");
  const projected = numberField(projection, "totalProjetado");
  const gain = numberField(projection, "totalGanho");

  return (
    <section className="glass-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#F0F1F5] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-[11px] bg-[#DFF2E7]">
              <LandmarkIcon className="size-4 text-[#1F6A47]" />
            </span>
            <div>
              <h2 className="text-[14px] font-bold text-[#16181D]">
                {CITY_REPORT_TYPE_LABELS[report.type] ?? report.title}
              </h2>
              <p className="mt-0.5 text-[9.5px] text-[#A2A6B2]">
                {municipality} · {report.cityUf} · exercício {report.exercise}
              </p>
            </div>
          </div>
        </div>
        {report.downloadUrl && (
          <button
            type="button"
            onClick={() => setPdfAberto(true)}
            className="flex h-9 items-center justify-center gap-2 rounded-full bg-[#16181D] px-4 text-[10.5px] font-bold text-white hover:bg-[#2C2F38]"
          >
            <EyeIcon className="size-3.5" />
            Abrir PDF exato
          </button>
        )}
      </div>

      {pdfAberto && report.downloadUrl && (
        <VisualizadorPdf
          url={report.downloadUrl}
          titulo={CITY_REPORT_TYPE_LABELS[report.type] ?? report.title}
          nomeArquivo={report.fileName}
          detalhe={`${municipality} · ${report.cityUf} · exercício ${report.exercise}`}
          onFechar={() => setPdfAberto(false)}
        />
      )}

      <div className="p-5">
        <div className="rounded-[17px] bg-gradient-to-br from-[#252832] to-[#3B3F4A] p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[9px] font-bold tracking-[1px] text-white/55 uppercase">
                Resumo do levantamento
              </div>
              <h3 className="mt-1 text-[16px] font-bold">{municipality}</h3>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[9px]">
              versão {formatDate(report.generatedAt)}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-white/10">
            <ReportMetric label="Atual" value={formatCurrency(current)} />
            <ReportMetric label="Projetado" value={formatCurrency(projected)} />
            <ReportMetric
              label="Ganho recuperável"
              value={`+${formatCurrency(gain)}`}
              positive
            />
          </div>
        </div>

        {snapshot ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PreviewBlock
              title="Complementações FUNDEB"
              rows={[
                [
                  "VAAF atual",
                  formatCurrency(numberField(projection, "vaafAtual")),
                ],
                [
                  "VAAT atual",
                  formatCurrency(numberField(projection, "vaatAtual")),
                ],
                [
                  "VAAR atual",
                  formatCurrency(numberField(projection, "vaarAtual")),
                ],
              ]}
            />
            <PreviewBlock
              title="Censo Escolar"
              rows={[
                [
                  "Matrículas",
                  formatInteger(numberField(census, "totalMatriculas")),
                ],
                ["Escolas", formatInteger(numberField(census, "totalEscolas"))],
                [
                  "Ganho percentual",
                  `${numberField(projection, "ganhoPercentual").toFixed(1)}%`,
                ],
              ]}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-[14px] border border-[#F2DEAF] bg-[#FFF9EC] p-4 text-[10.5px] text-[#7A642E]">
            Esta versão possui apenas o arquivo PDF. Abra o documento exato pelo
            botão acima.
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 rounded-[12px] bg-[#FAFAFC] px-3 py-2.5 text-[9.5px] text-[#767A86]">
          <CheckCircle2Icon className="size-3.5 text-[#1F6A47]" />
          Gerado por {report.generatedByName || "Global Sync"} em{" "}
          {formatDate(report.generatedAt)}
        </div>
      </div>
    </section>
  );
}

function DocumentsTab({
  documents,
  pending,
  onUpload,
}: {
  documents: CityDocument[];
  pending: boolean;
  onUpload: () => void;
}) {
  /* Só PDF abre por dentro: o visor embutido é o do Chromium, e DOCX ou XLSX
     nele viram tela em branco. Para esses, baixar continua sendo o caminho. */
  const [aberto, setAberto] = useState<CityDocument | null>(null);

  return (
    <section className="glass-card min-h-[460px] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#F0F1F5] p-4">
        <div>
          <h2 className="text-[13px] font-bold text-[#16181D]">
            Pasta digital da cidade
          </h2>
          <p className="mt-1 text-[10px] text-[#767A86]">
            Contratos, relatórios, ofícios, planilhas e qualquer outro arquivo.
          </p>
        </div>
        <Button
          type="button"
          onClick={onUpload}
          className="h-9 rounded-full bg-[#16181D] px-4 text-[11px] font-bold text-white"
        >
          <PaperclipIcon className="size-3.5" />
          Anexar
        </Button>
      </div>

      {pending ? (
        <div className="flex h-[360px] items-center justify-center">
          <LoaderCircleIcon className="size-6 animate-spin text-[#767A86]" />
        </div>
      ) : documents.length ? (
        <div className="divide-y divide-[#F4F5F8]">
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAFC]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-[#F2F1F7]">
                {document.source === "generated" ? (
                  <BotIcon className="size-4 text-[#67478C]" />
                ) : (
                  <FileIcon className="size-4 text-[#5A5E6A]" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-bold text-[#16181D]">
                  {document.title}
                </div>
                <div className="mt-1 truncate font-mono text-[8.5px] text-[#A2A6B2]">
                  {document.fileName} · {formatFileSize(document.fileSize)} ·{" "}
                  {formatDate(document.createdAt)}
                </div>
              </div>
              <span className="rounded-full bg-[#F2F1F7] px-2.5 py-1 text-[8.5px] font-bold text-[#5A5E6A]">
                {document.category.replaceAll("_", " ")}
              </span>
              {ehPdf(document) && (
                <button
                  type="button"
                  onClick={() => setAberto(document)}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-[#F2F1F7] px-3 text-[10px] font-bold text-[#3B3F4A] transition-colors hover:bg-[#ECEBF2]"
                  aria-label={`Abrir ${document.title} no app`}
                >
                  <EyeIcon className="size-3.5" />
                  Abrir
                </button>
              )}
              <a
                href={document.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="flex size-8 items-center justify-center rounded-full text-[#767A86] hover:bg-[#E2EDFA] hover:text-[#2C4E82]"
                aria-label={`Baixar ${document.title}`}
                title="Baixar"
              >
                <DownloadIcon className="size-3.5" />
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-[360px] flex-col items-center justify-center text-center">
          <FolderArchiveIcon className="size-7 text-[#A2A6B2]" />
          <h3 className="mt-3 text-[12px] font-bold text-[#16181D]">
            Nenhum documento anexado
          </h3>
          <p className="mt-1 text-[10px] text-[#767A86]">
            Use o botão Anexar para iniciar a pasta digital.
          </p>
        </div>
      )}

      {aberto && (
        <VisualizadorPdf
          url={aberto.downloadUrl}
          titulo={aberto.title}
          nomeArquivo={aberto.fileName}
          detalhe={`${aberto.cityName} · ${aberto.fileName} · ${formatFileSize(aberto.fileSize)}`}
          onFechar={() => setAberto(null)}
        />
      )}
    </section>
  );
}

/** O visor embutido só entende PDF — o resto continua sendo download. */
function ehPdf(documento: CityDocument): boolean {
  return (
    documento.mimeType === "application/pdf" ||
    documento.fileName.toLowerCase().endsWith(".pdf")
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

function SummaryNumber({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <div className="font-mono text-[16px] font-bold text-[#16181D]">
        {value}
      </div>
      <div className="mt-0.5 text-[8.5px] text-[#A2A6B2]">{label}</div>
    </div>
  );
}

function ReportMetric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <div className="font-mono text-[8.5px] text-white/50 uppercase">
        {label}
      </div>
      <div
        className={`mt-1 truncate font-mono text-[15px] font-bold ${
          positive ? "text-[#8FD3B6]" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function PreviewBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-[14px] border border-[#F0F1F5] bg-white p-4">
      <h3 className="text-[10.5px] font-bold text-[#16181D]">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 text-[9.5px]"
          >
            <span className="text-[#767A86]">{label}</span>
            <span className="font-mono font-bold text-[#3B3F4A]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function stringField(
  object: Record<string, unknown> | undefined,
  field: string,
): string {
  return typeof object?.[field] === "string" ? object[field] : "";
}

function numberField(
  object: Record<string, unknown> | undefined,
  field: string,
): number {
  const value = Number(object?.[field]);
  return Number.isFinite(value) ? value : 0;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatDate(value?: string): string {
  if (!value) return "agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(".", "");
}

function formatJsonSize(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
