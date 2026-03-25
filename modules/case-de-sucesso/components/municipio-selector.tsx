"use client";

import { useCaseSucessoMunicipios } from "../hooks/use-case-sucesso";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

interface MunicipioSelectorProps {
    onSelect: (municipio: string) => void;
    selectedMunicipio: string | null;
}

export function MunicipioSelector({ onSelect, selectedMunicipio }: MunicipioSelectorProps) {
    const [open, setOpen] = useState(false);
    const { data: municipios = [], isLoading } = useCaseSucessoMunicipios();

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {selectedMunicipio
                        ? selectedMunicipio
                        : "Selecione o municipio..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                    <CommandInput placeholder="Buscar municipio..." />
                    <CommandList>
                        <CommandEmpty>Nenhum municipio encontrado.</CommandEmpty>
                        <CommandGroup>
                            {municipios.map((m) => (
                                <CommandItem
                                    key={m}
                                    value={m}
                                    onSelect={(currentValue) => {
                                        onSelect(currentValue);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedMunicipio === m ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {m}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
