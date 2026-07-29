"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArchiveIcon,
  BotIcon,
  CalendarClockIcon,
  DownloadIcon,
  FileArchiveIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FilterIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  UploadCloudIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { getFirebaseDb, getFirebaseStorage } from "@/core/lib/firebase-client";
import { listCities } from "@/core/lib/cities-firestore";
import type { CityAccount } from "@/core/lib/city-types";
import { useAuth } from "@/core/providers/auth-provider";
import {
  deleteCityDocument,
  formatFileSize,
  listCityDocuments,
  uploadCityDocument,
} from "@/modules/documentos/documentos-firestore";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  type CityDocument,
  type CreateCityDocumentInput,
  type DocumentCategory,
} from "@/modules/documentos/types";

import { ContractGenerator } from "./_components/contract-generator";
import { DocumentUploadDialog } from "./_components/document-upload-dialog";

type WorkspaceTab = "acervo" | "gerar";

export default function DocumentosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("acervo");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | DocumentCategory>(
    "all",
  );
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const { data: cities = [], isPending: citiesPending } = useQuery({
    queryKey: ["documentos-cities", user?.groupId],
    queryFn: () => listCities(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  const {
    data: documents = [],
    isPending: documentsPending,
    error: documentsError,
  } = useQuery({
    queryKey: ["city-documents", user?.groupId],
    queryFn: () => listCityDocuments(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

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
      queryClient.invalidateQueries({
        queryKey: ["city-documents", user?.groupId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (document: CityDocument) =>
      deleteCityDocument(getFirebaseDb(), getFirebaseStorage(), document),
    onSuccess: () => {
      setOpenMenu(null);
      queryClient.invalidateQueries({
        queryKey: ["city-documents", user?.groupId],
      });
      toast.success("Documento excluído do acervo.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o documento.",
      );
    },
  });

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return documents.filter((document) => {
      if (cityFilter !== "all" && document.cityId !== cityFilter) return false;
      if (
        categoryFilter !== "all" &&
        document.category !== categoryFilter
      ) {
        return false;
      }
      if (!term) return true;
      const haystack =
        `${document.title} ${document.fileName} ${document.cityName} ${document.cityUf} ${document.contractNumber ?? ""}`.toLocaleLowerCase(
          "pt-BR",
        );
      return haystack.includes(term);
    });
  }, [documents, search, cityFilter, categoryFilter]);

  const metrics = useMemo(() => {
    const contracts = documents.filter(
      (document) => document.category === "contrato",
    );
    const today = new Date();
    const inNinetyDays = new Date();
    inNinetyDays.setDate(inNinetyDays.getDate() + 90);
    const expiring = contracts.filter((document) => {
      if (!document.expiresAt) return false;
      const date = new Date(`${document.expiresAt}T12:00:00`);
      return date >= today && date <= inNinetyDays;
    }).length;
    return {
      total: documents.length,
      cities: new Set(documents.map((document) => document.cityId)).size,
      contracts: contracts.length,
      expiring,
    };
  }, [documents]);

  const handleUpload = async (
    file: File,
    input: Omit<
      CreateCityDocumentInput,
      "groupId" | "createdBy" | "createdByName"
    >,
  ) => {
    await uploadMutation.mutateAsync({ file, input });
    setUploadOpen(false);
    toast.success("Documento anexado ao acervo.");
  };

  const archiveGeneratedContract = async (
    file: File,
    city: CityAccount,
    title: string,
    contractNumber?: string,
  ) => {
    await uploadMutation.mutateAsync({
      file,
      input: {
        cityId: city.id,
        cityName: city.name,
        cityUf: city.uf,
        category: "contrato",
        title,
        contractNumber,
        description:
          "Kit contratual gerado pelo modelo de Inexigibilidade · Consultoria FUNDEB.",
        source: "generated",
      },
    });
  };

  const confirmDelete = (document: CityDocument) => {
    const confirmed = window.confirm(
      `Excluir "${document.title}" do acervo? O arquivo também será removido do armazenamento e esta ação não pode ser desfeita.`,
    );
    if (confirmed) deleteMutation.mutate(document);
  };

  const loading = citiesPending || documentsPending;

  return (
    <div className="flex min-h-full flex-col gap-[14px] px-1 pb-4 pt-1">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[21px] font-bold tracking-[-0.7px] text-[#16181D]">
              Documentos
            </h1>
            <Badge
              variant="outline"
              className="h-[21px] rounded-full border-white bg-white/70 px-2.5 font-mono text-[9.5px] font-bold text-[#5A5E6A]"
            >
              {metrics.total} {metrics.total === 1 ? "arquivo" : "arquivos"}
            </Badge>
          </div>
          <p className="mt-1 text-[12.5px] text-[#767A86]">
            Acervo municipal, contratos e modelos gerados em um só lugar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-white/90 bg-white/65 p-1 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => setActiveTab("acervo")}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[11.5px] font-bold transition-all ${
                activeTab === "acervo"
                  ? "bg-[#16181D] text-white shadow-sm"
                  : "text-[#767A86] hover:text-[#16181D]"
              }`}
            >
              <ArchiveIcon className="size-3.5" />
              Acervo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("gerar")}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[11.5px] font-bold transition-all ${
                activeTab === "gerar"
                  ? "bg-[#16181D] text-white shadow-sm"
                  : "text-[#767A86] hover:text-[#16181D]"
              }`}
            >
              <SparklesIcon className="size-3.5" />
              Gerar contrato
            </button>
          </div>

          {activeTab === "acervo" && (
            <Button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="h-10 rounded-full bg-[#16181D] px-4 text-[11.5px] font-bold text-white shadow-sm hover:bg-[#2C2F38]"
            >
              <PlusIcon className="size-4" />
              Anexar documento
            </Button>
          )}
        </div>
      </header>

      {activeTab === "gerar" ? (
        <ContractGenerator
          cities={cities}
          onArchive={archiveGeneratedContract}
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Documentos"
              value={metrics.total}
              helper="no acervo"
              icon={FolderOpenIcon}
              iconBackground="#E2EDFA"
              iconColor="#2C4E82"
            />
            <MetricCard
              label="Municípios"
              value={metrics.cities}
              helper={`de ${cities.length} na carteira`}
              icon={ShieldCheckIcon}
              iconBackground="#DFF2E7"
              iconColor="#1F6A47"
            />
            <MetricCard
              label="Contratos"
              value={metrics.contracts}
              helper="anexados e gerados"
              icon={FileTextIcon}
              iconBackground="#EEE7F9"
              iconColor="#67478C"
            />
            <MetricCard
              label="A vencer"
              value={metrics.expiring}
              helper="nos próximos 90 dias"
              icon={CalendarClockIcon}
              iconBackground="#FBF0D9"
              iconColor="#8A5A00"
            />
          </section>

          <section className="glass-card min-h-[430px] overflow-visible">
            <div className="flex flex-col gap-3 border-b border-[#F0F1F5] p-4 lg:flex-row lg:items-center">
              <div className="relative min-w-[240px] flex-1">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#A2A6B2]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por documento, município ou número…"
                  className="h-10 rounded-full border-[#E7E8ED] bg-[#FAFAFC] pl-10 pr-4 text-[12px] placeholder:text-[#A2A6B2]"
                />
              </div>
              <div className="flex items-center gap-2">
                <FilterIcon className="hidden size-3.5 text-[#A2A6B2] lg:block" />
                <select
                  value={cityFilter}
                  onChange={(event) => setCityFilter(event.target.value)}
                  className="h-10 min-w-[170px] rounded-full border border-[#E7E8ED] bg-[#FAFAFC] px-3 text-[11px] font-semibold text-[#5A5E6A] outline-none focus:border-[#16181D]"
                >
                  <option value="all">Todos os municípios</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name} · {city.uf}
                    </option>
                  ))}
                </select>
                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(
                      event.target.value as "all" | DocumentCategory,
                    )
                  }
                  className="h-10 min-w-[150px] rounded-full border border-[#E7E8ED] bg-[#FAFAFC] px-3 text-[11px] font-semibold text-[#5A5E6A] outline-none focus:border-[#16181D]"
                >
                  <option value="all">Todas as categorias</option>
                  {DOCUMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {DOCUMENT_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex h-[340px] items-center justify-center">
                <LoaderCircleIcon className="size-6 animate-spin text-[#767A86]" />
              </div>
            ) : documentsError ? (
              <div className="flex h-[340px] flex-col items-center justify-center px-6 text-center">
                <div className="flex size-11 items-center justify-center rounded-[15px] bg-[#FBE9EE]">
                  <FileIcon className="size-5 text-[#8A3A50]" />
                </div>
                <p className="mt-3 text-[12px] font-bold text-[#16181D]">
                  Não foi possível carregar o acervo
                </p>
                <p className="mt-1 max-w-sm text-[10.5px] text-[#767A86]">
                  {documentsError instanceof Error
                    ? documentsError.message
                    : "Verifique a conexão e tente novamente."}
                </p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <EmptyLibrary
                hasFilters={
                  Boolean(search) ||
                  cityFilter !== "all" ||
                  categoryFilter !== "all"
                }
                onUpload={() => setUploadOpen(true)}
                onClearFilters={() => {
                  setSearch("");
                  setCityFilter("all");
                  setCategoryFilter("all");
                }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#F0F1F5] bg-[#FAFAFC]/70">
                      <TableHead>Documento</TableHead>
                      <TableHead>Município</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((document) => (
                      <DocumentRow
                        key={document.id}
                        document={document}
                        menuOpen={openMenu === document.id}
                        deleting={
                          deleteMutation.isPending &&
                          deleteMutation.variables?.id === document.id
                        }
                        onToggleMenu={() =>
                          setOpenMenu((current) =>
                            current === document.id ? null : document.id,
                          )
                        }
                        onDelete={() => confirmDelete(document)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {uploadOpen && (
        <DocumentUploadDialog
          open
          cities={cities}
          uploading={uploadMutation.isPending}
          onClose={() => {
            if (!uploadMutation.isPending) setUploadOpen(false);
          }}
          onSubmit={handleUpload}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  iconBackground,
  iconColor,
}: {
  label: string;
  value: number;
  helper: string;
  icon: React.ElementType;
  iconBackground: string;
  iconColor: string;
}) {
  return (
    <div className="glass-card flex min-h-[88px] items-center gap-3.5 p-4">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-[14px]"
        style={{ backgroundColor: iconBackground }}
      >
        <Icon className="size-[18px]" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[21px] font-bold tracking-[-0.7px] text-[#16181D]">
            {value}
          </span>
          <span className="text-[10.5px] font-bold text-[#5A5E6A]">{label}</span>
        </div>
        <p className="truncate text-[9.5px] text-[#A2A6B2]">{helper}</p>
      </div>
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left font-mono text-[9px] font-bold tracking-[0.8px] text-[#A2A6B2] uppercase">
      {children}
    </th>
  );
}

function DocumentRow({
  document,
  menuOpen,
  deleting,
  onToggleMenu,
  onDelete,
}: {
  document: CityDocument;
  menuOpen: boolean;
  deleting: boolean;
  onToggleMenu: () => void;
  onDelete: () => void;
}) {
  const expired =
    document.expiresAt &&
    new Date(`${document.expiresAt}T12:00:00`) < new Date();

  return (
    <tr className="group border-b border-[#F4F5F8] transition-colors last:border-0 hover:bg-[#FAFAFC]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-[#F2F1F7] transition-colors group-hover:bg-white">
            {renderFileIcon(document.fileName)}
          </div>
          <div className="min-w-0 max-w-[360px]">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[11.5px] font-bold text-[#16181D]">
                {document.title}
              </span>
              {document.source === "generated" && (
                <span
                  title="Gerado pelo sistema"
                  className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#EEE7F9]"
                >
                  <BotIcon className="size-2.5 text-[#67478C]" />
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate font-mono text-[9px] text-[#A2A6B2]">
              {document.fileName}
              {document.contractNumber
                ? ` · nº ${document.contractNumber}`
                : ""}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-[11px] font-semibold text-[#3B3F4A]">
          {document.cityName}
        </div>
        <div className="mt-0.5 font-mono text-[9px] text-[#A2A6B2]">
          {document.cityUf}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full bg-[#F2F1F7] px-2.5 py-1 text-[9.5px] font-semibold text-[#5A5E6A]">
          {DOCUMENT_CATEGORY_LABELS[document.category] ?? "Documento"}
        </span>
      </td>
      <td className="px-4 py-3">
        {document.expiresAt ? (
          <div>
            <span
              className={`text-[10.5px] font-semibold ${
                expired ? "text-[#8A3A50]" : "text-[#3B3F4A]"
              }`}
            >
              {expired ? "Venceu " : "Vence "}
              {formatDate(document.expiresAt)}
            </span>
            <div className="mt-0.5 text-[9px] text-[#A2A6B2]">
              enviado {formatDate(document.createdAt)}
            </div>
          </div>
        ) : (
          <span className="text-[10.5px] text-[#767A86]">
            {formatDate(document.createdAt)}
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-[9.5px] text-[#767A86]">
        {formatFileSize(document.fileSize)}
      </td>
      <td className="relative px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <a
            href={document.downloadUrl}
            target="_blank"
            rel="noreferrer"
            title="Baixar documento"
            className="flex size-8 items-center justify-center rounded-full text-[#767A86] transition-colors hover:bg-[#E2EDFA] hover:text-[#2C4E82]"
          >
            <DownloadIcon className="size-3.5" />
          </a>
          <button
            type="button"
            onClick={onToggleMenu}
            disabled={deleting}
            title="Mais ações"
            className="flex size-8 items-center justify-center rounded-full text-[#767A86] transition-colors hover:bg-[#F2F1F7] hover:text-[#16181D]"
          >
            {deleting ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : (
              <MoreHorizontalIcon className="size-4" />
            )}
          </button>
        </div>
        {menuOpen && (
          <div className="absolute right-4 top-10 z-30 w-[170px] rounded-[13px] border border-white bg-white p-1.5 text-left shadow-[0_16px_40px_rgba(22,24,29,.16)]">
            <a
              href={document.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 items-center gap-2 rounded-[9px] px-2.5 text-[10.5px] font-semibold text-[#3B3F4A] hover:bg-[#F2F1F7]"
            >
              <DownloadIcon className="size-3.5" />
              Abrir arquivo
            </a>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-8 w-full items-center gap-2 rounded-[9px] px-2.5 text-[10.5px] font-semibold text-[#8A3A50] hover:bg-[#FBE9EE]"
            >
              <Trash2Icon className="size-3.5" />
              Excluir do acervo
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function EmptyLibrary({
  hasFilters,
  onUpload,
  onClearFilters,
}: {
  hasFilters: boolean;
  onUpload: () => void;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex h-[340px] flex-col items-center justify-center px-6 text-center">
      <div className="relative flex size-[64px] items-center justify-center rounded-[20px] bg-[#F2F1F7]">
        <FolderOpenIcon className="size-7 text-[#767A86]" />
        {!hasFilters && (
          <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-[10px] border-4 border-white bg-[#E2EDFA]">
            <PaperclipIcon className="size-3 text-[#2C4E82]" />
          </span>
        )}
      </div>
      <h3 className="mt-4 text-[14px] font-bold text-[#16181D]">
        {hasFilters
          ? "Nenhum documento corresponde aos filtros"
          : "Seu acervo municipal começa aqui"}
      </h3>
      <p className="mt-1.5 max-w-[360px] text-[10.5px] leading-relaxed text-[#767A86]">
        {hasFilters
          ? "Altere a busca ou limpe os filtros para ver os outros arquivos."
          : "Anexe contratos, propostas, pareceres e outros arquivos. Cada documento fica ligado ao município certo."}
      </p>
      <Button
        type="button"
        onClick={hasFilters ? onClearFilters : onUpload}
        className="mt-5 h-9 rounded-full bg-[#16181D] px-4 text-[11px] font-bold text-white hover:bg-[#2C2F38]"
      >
        {hasFilters ? (
          <>
            <FilterIcon className="size-3.5" />
            Limpar filtros
          </>
        ) : (
          <>
            <UploadCloudIcon className="size-3.5" />
            Anexar primeiro documento
          </>
        )}
      </Button>
    </div>
  );
}

function renderFileIcon(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const className = "size-[17px] text-[#5A5E6A]";
  if (extension === "zip") return <FileArchiveIcon className={className} />;
  if (extension === "xls" || extension === "xlsx") {
    return <FileSpreadsheetIcon className={className} />;
  }
  if (extension === "pdf" || extension === "doc" || extension === "docx") {
    return <FileTextIcon className={className} />;
  }
  return <FileIcon className={className} />;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(".", "");
}
