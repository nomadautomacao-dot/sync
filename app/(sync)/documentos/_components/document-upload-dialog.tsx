"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CalendarIcon,
  FileUpIcon,
  LoaderCircleIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import type { CityAccount } from "@/core/lib/city-types";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  type CreateCityDocumentInput,
  type DocumentCategory,
} from "@/modules/documentos/types";
import {
  formatFileSize,
  validateCityDocumentFile,
} from "@/modules/documentos/documentos-firestore";

interface DocumentUploadDialogProps {
  open: boolean;
  cities: CityAccount[];
  initialCityId?: string;
  uploading: boolean;
  onClose: () => void;
  onSubmit: (
    file: File,
    input: Omit<
      CreateCityDocumentInput,
      "groupId" | "createdBy" | "createdByName"
    >,
  ) => Promise<void>;
}

export function DocumentUploadDialog({
  open,
  cities,
  initialCityId,
  uploading,
  onClose,
  onSubmit,
}: DocumentUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cityId, setCityId] = useState(initialCityId ?? "");
  const [category, setCategory] = useState<DocumentCategory>("contrato");
  const [title, setTitle] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !uploading) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, uploading, onClose]);

  if (!open) return null;

  const pickFile = (nextFile?: File) => {
    if (!nextFile) return;
    const validationError = validateCityDocumentFile(nextFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFile(nextFile);
    setError("");
    if (!title) setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const city = cities.find((item) => item.id === cityId);
    if (!file) return setError("Selecione um arquivo.");
    if (!city) return setError("Selecione o município do documento.");
    if (!title.trim()) return setError("Informe o título do documento.");

    setError("");
    try {
      await onSubmit(file, {
        cityId: city.id,
        cityName: city.name,
        cityUf: city.uf,
        category,
        title,
        description,
        contractNumber,
        signedAt,
        expiresAt,
        source: "upload",
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível anexar o documento.",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#16181D]/35 p-4 backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !uploading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-upload-title"
        className="max-h-[92vh] w-full max-w-[680px] overflow-y-auto rounded-[22px] border border-white bg-white shadow-[0_30px_90px_rgba(22,24,29,.25)]"
      >
        <div className="flex items-start justify-between border-b border-[#F0F1F5] px-6 py-5">
          <div>
            <div className="mb-2 flex size-9 items-center justify-center rounded-[12px] bg-[#E2EDFA]">
              <PaperclipIcon className="size-[18px] text-[#2C4E82]" />
            </div>
            <h2
              id="document-upload-title"
              className="text-[18px] font-bold tracking-[-0.45px] text-[#16181D]"
            >
              Anexar documento
            </h2>
            <p className="mt-1 text-[12.5px] text-[#767A86]">
              Organize o arquivo na pasta digital do município.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            aria-label="Fechar"
            className="flex size-8 items-center justify-center rounded-full bg-[#F2F1F7] text-[#767A86] transition-colors hover:bg-[#ECEBF2] hover:text-[#16181D] disabled:opacity-50"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
            onChange={(event) => pickFile(event.target.files?.[0])}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              pickFile(event.dataTransfer.files?.[0]);
            }}
            className={`flex min-h-[132px] w-full flex-col items-center justify-center rounded-[18px] border border-dashed px-5 text-center transition-colors ${
              dragging
                ? "border-[#2C4E82] bg-[#E2EDFA]"
                : file
                  ? "border-[#8FD3B6] bg-[#F2FAF6]"
                  : "border-[#D9DBE3] bg-[#FAFAFC] hover:border-[#A2A6B2] hover:bg-[#F7F6FA]"
            }`}
          >
            <div
              className={`flex size-10 items-center justify-center rounded-[14px] ${
                file ? "bg-[#DFF2E7]" : "bg-white shadow-sm"
              }`}
            >
              <FileUpIcon
                className={`size-5 ${file ? "text-[#1F6A47]" : "text-[#5A5E6A]"}`}
              />
            </div>
            <span className="mt-3 text-[13px] font-semibold text-[#16181D]">
              {file ? file.name : "Arraste o arquivo ou clique para selecionar"}
            </span>
            <span className="mt-1 font-mono text-[10px] text-[#A2A6B2]">
              {file
                ? formatFileSize(file.size)
                : "PDF, DOCX, XLSX, imagem ou ZIP · máximo 20 MB"}
            </span>
          </button>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Município" required>
              <select
                value={cityId}
                onChange={(event) => setCityId(event.target.value)}
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

            <Field label="Categoria" required>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as DocumentCategory)
                }
                className="h-10 w-full rounded-[12px] border border-[#E2E3E9] bg-white px-3 text-[12.5px] font-medium text-[#16181D] outline-none focus:border-[#16181D] focus:ring-2 focus:ring-[#16181D]/10"
              >
                {DOCUMENT_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {DOCUMENT_CATEGORY_LABELS[item]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Título do documento" required>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Contrato de consultoria FUNDEB 2026"
              className="h-10 rounded-[12px] border-[#E2E3E9] px-3 text-[12.5px]"
            />
          </Field>

          {category === "contrato" && (
            <div className="rounded-[16px] border border-[#F0F1F5] bg-[#FAFAFC] p-4">
              <div className="mb-3 flex items-center gap-2">
                <CalendarIcon className="size-4 text-[#767A86]" />
                <span className="text-[11.5px] font-bold text-[#3B3F4A]">
                  Dados do contrato
                </span>
                <span className="text-[10px] text-[#A2A6B2]">opcional</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Número">
                  <Input
                    value={contractNumber}
                    onChange={(event) => setContractNumber(event.target.value)}
                    placeholder="001/2026"
                    className="h-9 rounded-[10px] bg-white text-[12px]"
                  />
                </Field>
                <Field label="Assinatura">
                  <Input
                    type="date"
                    value={signedAt}
                    onChange={(event) => setSignedAt(event.target.value)}
                    className="h-9 rounded-[10px] bg-white text-[12px]"
                  />
                </Field>
                <Field label="Vencimento">
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="h-9 rounded-[10px] bg-white text-[12px]"
                  />
                </Field>
              </div>
            </div>
          )}

          <Field label="Observações">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Contexto, responsável ou informação útil para localizar o documento…"
              rows={3}
              className="w-full resize-none rounded-[12px] border border-[#E2E3E9] bg-white px-3 py-2.5 text-[12.5px] text-[#16181D] outline-none placeholder:text-[#A2A6B2] focus:border-[#16181D] focus:ring-2 focus:ring-[#16181D]/10"
            />
          </Field>

          {error && (
            <div
              role="alert"
              className="rounded-[12px] border border-[#F3CDD5] bg-[#FBE9EE] px-3.5 py-2.5 text-[11.5px] font-medium text-[#8A3A50]"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-[#F0F1F5] pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={uploading}
              className="h-10 rounded-full px-5 text-[12px] font-semibold text-[#5A5E6A]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={uploading}
              className="h-10 min-w-[150px] rounded-full bg-[#16181D] px-5 text-[12px] font-bold text-white hover:bg-[#2C2F38]"
            >
              {uploading ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <PaperclipIcon className="size-4" />
                  Anexar documento
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10.5px] font-bold tracking-[0.1px] text-[#5A5E6A]">
        {label}
        {required && <span className="ml-0.5 text-[#8A3A50]">*</span>}
      </span>
      {children}
    </label>
  );
}
