"use client";

import { Building2, Cog, LayoutGrid, PlusCircle, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCompanies } from "@/core/hooks/use-companies";
import { useEmployees } from "@/core/hooks/use-employees";
import { moduleCatalog } from "@/core/domain/module";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: companies = [] } = useCompanies();
  const { data: employees = [] } = useEmployees();

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const commandGroups = useMemo(
    () => ({
      companies: companies.slice(0, 6),
      employees: employees.slice(0, 6),
      modules: moduleCatalog,
    }),
    [companies, employees],
  );

  if (!open) {
    return null;
  }

  return (
    <CommandDialog>
      <Command>
        <CommandInput placeholder="Buscar empresa, pessoa, modulo..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Acoes rapidas">
            <CommandItem
              onSelect={() => {
                router.push("/companies");
                setOpen(false);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova empresa
              <CommandShortcut>Enter</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                router.push("/settings");
                setOpen(false);
              }}
            >
              <Cog className="mr-2 h-4 w-4" />
              Configuracoes
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Empresas">
            {commandGroups.companies.map((company) => (
              <CommandItem
                key={company.id}
                value={`${company.tradingName} ${company.cnpj}`}
                onSelect={() => {
                  router.push(`/companies/${company.id}`);
                  setOpen(false);
                }}
              >
                <Building2 className="mr-2 h-4 w-4" />
                {company.tradingName}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Pessoas">
            {commandGroups.employees.map((employee) => (
              <CommandItem
                key={employee.id}
                value={`${employee.name} ${employee.position}`}
                onSelect={() => {
                  router.push("/people");
                  setOpen(false);
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                {employee.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Modulos">
            {commandGroups.modules.map((module) => (
              <CommandItem
                key={module.key}
                value={module.label}
                onSelect={() => {
                  router.push("/modules");
                  setOpen(false);
                }}
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                {module.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
