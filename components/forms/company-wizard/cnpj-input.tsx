"use client";

import { Input } from "@/components/ui/input";
import { isValidCnpj, maskCnpj } from "@/components/forms/company-wizard/formatters";

interface CnpjInputProps {
  id: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function CnpjInput({ id, value = "", onChange, onBlur, disabled }: CnpjInputProps) {
  const masked = maskCnpj(value);
  const showError = masked.length > 0 && masked.length >= 18 && !isValidCnpj(masked);

  return (
    <div className="space-y-1">
      <Input
        id={id}
        value={masked}
        onChange={(event) => onChange(maskCnpj(event.target.value))}
        onBlur={onBlur}
        disabled={disabled}
        placeholder="00.000.000/0000-00"
      />
      {showError ? (
        <p className="text-xs text-[var(--sync-status-error)]">CNPJ invalido</p>
      ) : null}
    </div>
  );
}
