"use client";

import { useState } from "react";
import { toast } from "sonner";
import { moduleCatalog, type ModuleKey } from "@/core/domain/module";
import { Button } from "@/components/ui/button";
import { ModuleIcon } from "@/components/shared/module-icon";

interface ModuleConfigFormProps {
  companyName: string;
  initialModules: ModuleKey[];
  onSave?: (modules: ModuleKey[]) => void;
}

export function ModuleConfigForm({
  companyName,
  initialModules,
  onSave,
}: ModuleConfigFormProps) {
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>(initialModules);

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--sync-text-secondary)]">
        Modulos habilitados para <span className="font-semibold">{companyName}</span>
      </p>
      <div className="space-y-2">
        {moduleCatalog.map((module) => {
          const enabled = selectedModules.includes(module.key);
          return (
            <label
              key={module.key}
              className="flex cursor-pointer items-center justify-between rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <ModuleIcon moduleKey={module.key} className="h-4 w-4" />
                <span>{module.label}</span>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => {
                  if (event.target.checked) {
                    setSelectedModules((current) => [...current, module.key]);
                  } else {
                    setSelectedModules((current) =>
                      current.filter((key) => key !== module.key),
                    );
                  }
                }}
              />
            </label>
          );
        })}
      </div>
      <Button
        type="button"
        onClick={() => {
          onSave?.(selectedModules);
          toast.success("Configuracao de modulos atualizada.");
        }}
      >
        Salvar configuracao
      </Button>
    </div>
  );
}
