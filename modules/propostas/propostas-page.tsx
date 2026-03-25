"use client";

import { useEffect, useState } from "react";
import { getWorkspaceSettings } from "@/app/(workspace)/settings/settings-actions";
import { PageHeader } from "@/components/shared/page-header";
import { PropostasWizard } from "./components/propostas-wizard";
import { DEFAULT_EMPRESA_CONFIG, type EmpresaConfig } from "./types";

export function PropostasPage() {
  const [config, setConfig] = useState<EmpresaConfig>(DEFAULT_EMPRESA_CONFIG);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const defaultSettings = await getWorkspaceSettings();
        if (defaultSettings?.settings?.empresaPadrao) {
          setConfig((current) => ({
            ...current,
            ...(defaultSettings.settings.empresaPadrao as Partial<EmpresaConfig>),
          }));
        }
      } catch (error) {
        console.error("Erro ao carregar configuracoes do workspace:", error);
      }
    };

    loadSettings();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Propostas Comerciais"
        description="Geração padronizada de proposta comercial e minuta contratual a partir dos modelos analisados."
      />
      <PropostasWizard config={config} />
    </div>
  );
}
