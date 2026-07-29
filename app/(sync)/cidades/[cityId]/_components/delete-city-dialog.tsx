"use client";

import { useRef } from "react";
import {
  AlertTriangleIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/core/components/ui/button";

import styles from "./delete-city-dialog.module.css";

interface DeleteCityDialogProps {
  cityName: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCityDialog({
  cityName,
  deleting,
  onClose,
  onConfirm,
}: DeleteCityDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open && !deleting) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content
          ref={contentRef}
          tabIndex={-1}
          className={styles.content}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (deleting) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (deleting) event.preventDefault();
          }}
        >
          <div className={styles.header}>
            <div className={styles.titleRow}>
              <span className={styles.alertIcon}>
                <AlertTriangleIcon aria-hidden="true" />
              </span>
              <DialogPrimitive.Title className={styles.title}>
                Excluir {cityName}?
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Description className={styles.description}>
              A cidade deixará de aparecer na carteira, no pipeline e nos
              painéis da equipe.
            </DialogPrimitive.Description>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                disabled={deleting}
                aria-label="Fechar"
                className={styles.closeButton}
              >
                <XIcon aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </div>

          <div className={styles.preservation}>
            <span className={styles.preservationIcon}>
              <ShieldCheckIcon aria-hidden="true" />
            </span>
            <div>
              <p className={styles.preservationTitle}>
                O histórico não será apagado
              </p>
              <p className={styles.preservationDescription}>
                Relatórios, arquivos JSON e documentos continuarão armazenados
                para consulta e eventual restauração.
              </p>
            </div>
          </div>

          <div className={styles.footer}>
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                className={styles.cancelButton}
              >
                Cancelar
              </Button>
            </DialogPrimitive.Close>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={deleting}
              className={styles.deleteButton}
            >
              {deleting ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className={styles.spinner}
                />
              ) : (
                <Trash2Icon aria-hidden="true" />
              )}
              {deleting ? "Excluindo..." : "Excluir cidade"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
