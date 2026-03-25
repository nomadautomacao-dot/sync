"use client";

import { Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";

const MAX_SIZE = 2 * 1024 * 1024;

interface LogoUploaderProps {
  value?: string;
  onChange: (value?: string) => void;
}

export function LogoUploader({ value, onChange }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }

    if (file.size > MAX_SIZE) {
      toast.error("A logo deve ter no maximo 2MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const response = await fetch("/api/companies/upload-logo", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Falha ao enviar logo");
      }

      onChange(result.url);
      toast.success("Logo enviada com sucesso");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro no upload";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
          event.currentTarget.value = "";
        }}
      />

      <button
        type="button"
        className={cn(
          "relative flex w-full items-center justify-center rounded-[var(--sync-radius-lg)] border border-dashed border-[var(--sync-border-medium)] bg-[var(--sync-bg-surface)] px-4 py-6 text-center transition-colors",
          isDragging && "border-[var(--sync-accent)] bg-[var(--sync-accent-muted)]",
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void handleUpload(file);
        }}
      >
        {isUploading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--sync-text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando logo...
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="mx-auto h-5 w-5 text-[var(--sync-text-tertiary)]" />
            <p className="text-sm text-[var(--sync-text-secondary)]">
              Arraste a logo ou clique para selecionar
            </p>
            <p className="text-xs text-[var(--sync-text-tertiary)]">JPG, PNG ou SVG ate 2MB</p>
          </div>
        )}
      </button>

      {value ? (
        <div className="flex items-center gap-3">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)]">
            <Image src={value} alt="Logo da empresa" fill className="object-cover" unoptimized />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            <X className="h-4 w-4" />
            Remover
          </Button>
        </div>
      ) : null}
    </div>
  );
}
