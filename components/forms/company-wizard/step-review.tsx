"use client";

import { Building2, Globe, Mail, MapPin, Package, Pencil, Phone, User } from "lucide-react";
import Image from "next/image";
import type { UseFormReturn } from "react-hook-form";
import { maskCnpj, maskPhone, maskZipCode } from "@/components/forms/company-wizard/formatters";
import type { CompanyCreateInput } from "@/components/forms/company-wizard/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { moduleCatalog } from "@/core/domain/module";

interface StepReviewProps {
  form: UseFormReturn<CompanyCreateInput>;
  onEditStep: (stepIndex: number) => void;
}

function infoValue(value?: string, fallback = "Nao informado") {
  const cleaned = value?.trim();
  return cleaned ? cleaned : fallback;
}

export function StepReview({ form, onEditStep }: StepReviewProps) {
  const values = form.watch();
  const selectedModules = moduleCatalog.filter((module) =>
    (values.enabledModules ?? []).includes(module.key),
  );

  const identityLine = `${infoValue(values.tradingName)} | ${infoValue(values.name)}`;
  const addressLine = [
    values.street,
    values.number,
    values.complement,
    values.neighborhood,
    values.city,
    values.state,
  ]
    .filter((item) => item && item.trim())
    .join(", ");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--sync-text-primary)]">Revisao e confirmacao</h2>
        <p className="text-sm text-[var(--sync-text-secondary)]">
          Confira os dados antes de concluir o cadastro da empresa.
        </p>
      </div>

      <Card className="bg-[var(--sync-bg-surface)]">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]">
            {values.logo ? (
              <Image src={values.logo} alt="Logo da empresa" fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--sync-text-tertiary)]">
                <Building2 className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-[var(--sync-text-primary)]">{identityLine}</p>
            <p className="text-sm text-[var(--sync-text-secondary)]">CNPJ: {maskCnpj(values.cnpj ?? "")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{infoValue(values.segment)}</Badge>
              <Badge variant="active">Ativo</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[var(--sync-bg-surface)]">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[var(--sync-text-secondary)]" />
            Endereco
          </CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={() => onEditStep(1)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-[var(--sync-text-secondary)]">
          <p>{addressLine || "Nao informado"}</p>
          <p>CEP: {maskZipCode(values.zipCode ?? "") || "Nao informado"}</p>
        </CardContent>
      </Card>

      <Card className="bg-[var(--sync-bg-surface)]">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[var(--sync-text-secondary)]" />
            Contato
          </CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={() => onEditStep(2)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-[var(--sync-text-secondary)]">
          <p>{maskPhone(values.phone ?? "") || "Nao informado"}</p>
          <p className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            {infoValue(values.email)}
          </p>
          <p className="flex items-center gap-2">
            <User className="h-3.5 w-3.5" />
            {infoValue(values.contactName)} | {infoValue(values.contactPosition)}
          </p>
          <p>{infoValue(values.contactEmail)}</p>
          {values.website ? (
            <a
              href={values.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-[var(--sync-text-primary)] hover:underline"
            >
              <Globe className="h-3.5 w-3.5" />
              {values.website}
            </a>
          ) : null}
        </CardContent>
      </Card>

      <Card className="bg-[var(--sync-bg-surface)]">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[var(--sync-text-secondary)]" />
            Modulos ativos ({selectedModules.length})
          </CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={() => onEditStep(3)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {selectedModules.length > 0 ? (
              selectedModules.map((module) => (
                <Badge key={module.key} variant="default">
                  {module.label}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-[var(--sync-text-secondary)]">Nenhum modulo habilitado.</p>
            )}
          </div>
          <div className="grid gap-1 text-sm text-[var(--sync-text-secondary)] md:grid-cols-2">
            <p>Porte: {infoValue(values.size)}</p>
            <p>Regime: {infoValue(values.taxRegime)}</p>
          </div>
          <p className="text-sm text-[var(--sync-text-secondary)]">Descricao: {infoValue(values.description)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
