"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { digitsOnly, maskZipCode } from "@/components/forms/company-wizard/formatters";

export interface ViaCepAddress {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

interface CepInputProps {
  id: string;
  value?: string;
  onChange: (value: string) => void;
  onAddressResolved: (address: ViaCepAddress) => void;
  onInvalidCep?: () => void;
}

export function CepInput({
  id,
  value = "",
  onChange,
  onAddressResolved,
  onInvalidCep,
}: CepInputProps) {
  const [isLoading, setIsLoading] = useState(false);
  const lastSearched = useRef<string>("");
  const masked = maskZipCode(value);

  useEffect(() => {
    const digits = digitsOnly(masked);
    if (digits.length !== 8 || digits === lastSearched.current) {
      return;
    }

    let cancelled = false;
    lastSearched.current = digits;

    async function fetchCep() {
      setIsLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = (await response.json()) as {
          logradouro?: string;
          bairro?: string;
          localidade?: string;
          uf?: string;
          erro?: boolean;
        };

        if (cancelled) return;

        if (!response.ok || data.erro) {
          onInvalidCep?.();
          return;
        }

        onAddressResolved({
          street: data.logradouro ?? "",
          neighborhood: data.bairro ?? "",
          city: data.localidade ?? "",
          state: data.uf ?? "",
        });
      } catch {
        if (!cancelled) onInvalidCep?.();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchCep();
    return () => {
      cancelled = true;
    };
  }, [masked, onAddressResolved, onInvalidCep]);

  return (
    <div className="relative">
      <Input
        id={id}
        value={masked}
        onChange={(event) => onChange(maskZipCode(event.target.value))}
        placeholder="00000-000"
      />
      {isLoading ? (
        <Loader2 className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--sync-text-tertiary)]" />
      ) : null}
    </div>
  );
}
